import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import {
  checkIsAdminServer,
  createFirestoreDoc,
  deleteFirestoreDoc,
  fetchFirestoreDoc,
  patchFirestoreFields,
  verifyFirebaseBearerToken,
  type VerifiedFirebaseUser,
} from '../firebaseAdmin';
import { extractAndValidateYouTubeUrl } from '../youtubeValidation';

interface AuthedRequest extends Request {
  authUser?: VerifiedFirebaseUser;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function isValidEntityId(id: string): boolean {
  return VALID_ID_REGEX.test(id);
}

// Per-user cooldown & anti-duplicate spam guard (server memory, zero external cost)
const userCommentState = new Map<
  string,
  { lastAt: number; lastText: string; lastTextAt: number }
>();

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const authed = (req as AuthedRequest).authUser;
    return authed?.uid || req.ip || 'anon';
  },
  message: {
    error: 'Trop de messages envoyés en peu de temps. Veuillez patienter quelques instants.',
  },
});

const liveMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes sur les sessions Live. Veuillez patienter une minute.',
  },
});

async function requireFirebaseAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    req.authUser = user;
    next();
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'AUTH_MISSING') {
      res.status(401).json({ error: 'Authentification requise pour cette action.' });
      return;
    }
    res.status(401).json({ error: 'Session expirée. Veuillez vous reconnecter.' });
  }
}

export function createLiveRouter() {
  const router = express.Router();

  // 1. Validate YouTube Live URL server-side (no API key required, strict domain + 11-char ID check)
  router.post(
    '/validate-youtube',
    liveMutationLimiter,
    requireFirebaseAuth,
    (req: AuthedRequest, res: Response) => {
      try {
        const rawUrl = String(req.body?.youtubeUrl || req.body?.url || '');
        const validated = extractAndValidateYouTubeUrl(rawUrl);
        res.json(validated);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Lien YouTube Live invalide.',
        });
      }
    },
  );

  // 2. Attach / update validated YouTube Live link on an owned Live session
  router.post(
    '/:liveId/youtube',
    liveMutationLimiter,
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const liveId = String(req.params.liveId || '').trim();
      if (!isValidEntityId(liveId)) {
        res.status(400).json({ error: 'Identifiant de live invalide.' });
        return;
      }

      try {
        const validated = extractAndValidateYouTubeUrl(
          String(req.body?.youtubeUrl || req.body?.url || ''),
        );
        const liveDoc = await fetchFirestoreDoc('lives', liveId, user.idToken);
        if (!liveDoc) {
          res.status(404).json({ error: 'Session Live introuvable.' });
          return;
        }
        if (String(liveDoc.sellerId || '') !== user.uid) {
          res.status(403).json({
            error: 'Accès refusé : vous ne pouvez modifier que vos propres diffusions.',
          });
          return;
        }

        await patchFirestoreFields(
          'lives',
          liveId,
          {
            streamProvider: 'youtube',
            streamUrl: validated.youtubeUrl,
            youtubeUrl: validated.youtubeUrl,
            youtubeVideoId: validated.videoId,
            embedUrl: validated.embedUrl,
          },
          user.idToken,
        );

        res.json({
          liveId,
          ...validated,
        });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Accès refusé par les règles de sécurité.' });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Impossible d’enregistrer le lien YouTube.',
        });
      }
    },
  );

  // 3. Rate-limited, anti-spam Live Chat comment endpoint
  router.post(
    '/:liveId/comments',
    requireFirebaseAuth,
    commentLimiter,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const liveId = String(req.params.liveId || '').trim();
      if (!isValidEntityId(liveId)) {
        res.status(400).json({ error: 'Identifiant de live invalide.' });
        return;
      }

      const rawText = String(req.body?.text || '').replace(/\s+/g, ' ').trim();
      if (!rawText || rawText.length > 500) {
        res.status(400).json({
          error: 'Le message doit contenir entre 1 et 500 caractères.',
        });
        return;
      }

      // Simple anti-spam repeated character flood filter (e.g. 25+ identical chars)
      if (/(.)\1{24,}/.test(rawText)) {
        res.status(400).json({
          error: 'Message bloqué par le filtre anti-spam.',
        });
        return;
      }

      const now = Date.now();
      const prev = userCommentState.get(user.uid);
      if (prev) {
        if (now - prev.lastAt < 2500) {
          res.status(429).json({
            error: 'Veuillez patienter quelques secondes avant d’envoyer un autre message.',
          });
          return;
        }
        if (
          prev.lastText.toLowerCase() === rawText.toLowerCase() &&
          now - prev.lastTextAt < 15000
        ) {
          res.status(400).json({
            error: 'Ce message identique vient déjà d’être envoyé.',
          });
          return;
        }
      }

      try {
        const liveDoc = await fetchFirestoreDoc('lives', liveId, user.idToken);
        if (!liveDoc) {
          res.status(404).json({ error: 'Session Live introuvable.' });
          return;
        }
        if (Boolean(liveDoc.moderatedHidden) || String(liveDoc.status || '') === 'annule') {
          res.status(403).json({
            error: 'Le chat est fermé pour cette diffusion.',
          });
          return;
        }

        const userDoc = await fetchFirestoreDoc('users', user.uid, user.idToken).catch(() => null);
        if (userDoc && Boolean(userDoc.suspended)) {
          res.status(403).json({ error: 'Votre compte est suspendu.' });
          return;
        }

        const displayName =
          String(userDoc?.fullName || '').trim() ||
          String(req.body?.userName || '').trim() ||
          'Acheteur TSM';
        const avatarUrl = String(userDoc?.photoURL || req.body?.userAvatar || '').slice(0, 1000);
        const requestedType = String(req.body?.reactionType || 'comment');
        const isQuestion = requestedType === 'question' || rawText.includes('?');
        const reactionType: 'comment' | 'question' | 'reaction' =
          requestedType === 'reaction'
            ? 'reaction'
            : isQuestion
              ? 'question'
              : 'comment';

        const commentId = `cmt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
        const createdAt = new Date().toISOString();

        const commentData = {
          commentId,
          liveId,
          userId: user.uid,
          userName: displayName.slice(0, 100),
          userAvatar: avatarUrl,
          text: rawText,
          isQuestion,
          reactionType,
          hidden: false,
          createdAt,
        };

        await createFirestoreDoc(`lives/${liveId}/comments`, commentId, commentData, user.idToken);

        userCommentState.set(user.uid, {
          lastAt: now,
          lastText: rawText,
          lastTextAt: now,
        });

        res.status(201).json({
          comment: {
            id: commentId,
            ...commentData,
          },
        });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Action non autorisée sur ce chat.' });
          return;
        }
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Erreur lors de l’envoi du commentaire.',
        });
      }
    },
  );

  // 4. Delete comment (allowed for comment author, live vendor, or admin)
  router.delete(
    '/:liveId/comments/:commentId',
    liveMutationLimiter,
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const liveId = String(req.params.liveId || '').trim();
      const commentId = String(req.params.commentId || '').trim();
      if (!isValidEntityId(liveId) || !isValidEntityId(commentId)) {
        res.status(400).json({ error: 'Identifiant invalide.' });
        return;
      }

      try {
        const [liveDoc, commentDoc, isAdmin] = await Promise.all([
          fetchFirestoreDoc('lives', liveId, user.idToken),
          fetchFirestoreDoc(`lives/${liveId}/comments`, commentId, user.idToken),
          checkIsAdminServer(user),
        ]);

        if (!liveDoc) {
          res.status(404).json({ error: 'Session Live introuvable.' });
          return;
        }
        if (!commentDoc) {
          res.status(404).json({ error: 'Commentaire introuvable.' });
          return;
        }

        const isCommentAuthor = String(commentDoc.userId || '') === user.uid;
        const isLiveVendor = String(liveDoc.sellerId || '') === user.uid;

        if (!isCommentAuthor && !isLiveVendor && !isAdmin) {
          res.status(403).json({
            error: 'Accès refusé : seul le vendeur du live, l’auteur ou un administrateur peut supprimer ce message.',
          });
          return;
        }

        await deleteFirestoreDoc(`lives/${liveId}/comments`, commentId, user.idToken);
        res.json({ deleted: true, commentId });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Suppression refusée par les règles Firestore.' });
          return;
        }
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Erreur lors de la suppression.',
        });
      }
    },
  );

  return router;
}
