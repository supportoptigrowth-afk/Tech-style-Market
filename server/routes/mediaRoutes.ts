import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import {
  CLOUDINARY_FREE_LIMITS,
  configureCloudinary,
  getMediaQuotaReport,
  invalidateUsageCache,
  isCloudinaryConfigured,
  recordLocalCloudinaryDelete,
  recordLocalCloudinaryUpload,
} from '../cloudinaryConfig';
import {
  fetchFirestoreDoc,
  fetchOwnerStores,
  patchFirestoreFields,
  verifyFirebaseBearerToken,
  type VerifiedFirebaseUser,
} from '../firebaseAdmin';
import { MAX_IMAGE_BYTES, validateUploadedImageFile } from '../imageValidation';

interface AuthedRequest extends Request {
  authUser?: VerifiedFirebaseUser;
}

export interface ServerProductImageMeta {
  fileId: string;
  publicId?: string;
  fileName?: string;
  ownerId?: string;
  url: string;
  storagePath?: string;
  isPrimary: boolean;
  order: number;
  uploadedAt: string;
}

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

function isValidEntityId(id: string): boolean {
  return VALID_ID_REGEX.test(id);
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: 1,
  },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 35,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes d’importation ou de modification d’images. Veuillez patienter une minute.',
  },
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de requêtes de consultation média. Veuillez patienter.',
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
      res.status(401).json({ error: 'Authentification Firebase requise (jeton Bearer manquant).' });
      return;
    }
    res.status(401).json({ error: 'Jeton Firebase invalide ou expiré. Veuillez vous reconnecter.' });
  }
}

function handleSingleFileUpload(req: Request, res: Response, next: NextFunction) {
  uploadMiddleware.single('image')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: 'Le fichier dépasse la limite maximale de 5 Mo autorisée par photo.',
        });
        return;
      }
      res.status(400).json({ error: `Erreur de réception du fichier : ${err.message}` });
      return;
    }
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Erreur lors du traitement du fichier.',
    });
  });
}

function parseProductImagesFromDoc(docData: Record<string, unknown>): ServerProductImageMeta[] {
  const createdAt = String(docData.createdAt || new Date().toISOString());
  const sellerId = String(docData.sellerId || '');
  if (Array.isArray(docData.productImages) && docData.productImages.length > 0) {
    return docData.productImages
      .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object' && 'url' in m))
      .map((m, idx) => ({
        fileId: String(m.fileId || m.publicId || `img_${idx}`),
        ...(typeof m.publicId === 'string' && m.publicId ? { publicId: m.publicId } : {}),
        ...(typeof m.fileName === 'string' && m.fileName ? { fileName: m.fileName } : {}),
        ...(typeof m.ownerId === 'string' && m.ownerId
          ? { ownerId: m.ownerId }
          : sellerId
            ? { ownerId: sellerId }
            : {}),
        url: String(m.url || ''),
        ...(typeof m.storagePath === 'string' && m.storagePath ? { storagePath: m.storagePath } : {}),
        isPrimary: Boolean(m.isPrimary),
        order: typeof m.order === 'number' ? Number(m.order) : idx + 1,
        uploadedAt: String(m.uploadedAt || createdAt),
      }))
      .filter((m) => m.url.trim().length > 0);
  }
  if (Array.isArray(docData.images)) {
    return docData.images
      .map(String)
      .filter((u) => u.trim().length > 0)
      .map((url, idx) => ({
        fileId: `legacy_${idx}`,
        ...(sellerId ? { ownerId: sellerId } : {}),
        url,
        isPrimary: idx === 0,
        order: idx + 1,
        uploadedAt: createdAt,
      }));
  }
  return [];
}

function normalizeAndOrderProductImages(
  list: ServerProductImageMeta[],
  ownerId?: string,
): { images: string[]; productImages: ServerProductImageMeta[] } {
  const clean = list.filter((item) => item.url && item.url.trim().length > 0).slice(0, 8);
  if (clean.length === 0) {
    return { images: [], productImages: [] };
  }
  if (!clean.some((p) => p.isPrimary)) {
    clean[0] = { ...clean[0], isPrimary: true };
  }
  const ordered = [...clean].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.order - b.order;
  });
  const normalizedMeta: ServerProductImageMeta[] = ordered.map((p, idx) => ({
    fileId: p.publicId || p.fileId || `img_${idx + 1}`,
    ...(p.publicId ? { publicId: p.publicId } : {}),
    ...(p.fileName ? { fileName: p.fileName } : {}),
    ...(p.ownerId || ownerId ? { ownerId: p.ownerId || ownerId } : {}),
    url: p.url.trim(),
    ...(p.storagePath ? { storagePath: p.storagePath } : {}),
    isPrimary: idx === 0,
    order: idx + 1,
    uploadedAt: p.uploadedAt || new Date().toISOString(),
  }));

  return {
    images: normalizedMeta.map((m) => m.url),
    productImages: normalizedMeta,
  };
}

async function uploadBufferToCloudinary(
  buffer: Buffer,
  folder: string,
  baseName: string,
): Promise<{ secureUrl: string; publicId: string; bytes: number; format: string; width: number; height: number }> {
  const cld = configureCloudinary();
  const safeBase = baseName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'img';
  const publicIdSlug = `${safeBase}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;

  return await new Promise((resolve, reject) => {
    const stream = cld.uploader.upload_stream(
      {
        folder,
        public_id: publicIdSlug,
        resource_type: 'image',
        overwrite: false,
        transformation: [
          { width: 1600, height: 1600, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (err, result) => {
        if (err || !result) {
          reject(
            new Error(
              err instanceof Error
                ? `Erreur Cloudinary : ${err.message}`
                : 'Échec de l’envoi vers Cloudinary.',
            ),
          );
          return;
        }
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          bytes: Number(result.bytes || buffer.length),
          format: String(result.format || ''),
          width: Number(result.width || 0),
          height: Number(result.height || 0),
        });
      },
    );
    stream.end(buffer);
  });
}

async function destroyCloudinaryPublicId(publicId: string): Promise<void> {
  if (!publicId || !isCloudinaryConfigured()) return;
  const cld = configureCloudinary();
  await cld.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  recordLocalCloudinaryDelete();
  invalidateUsageCache();
}

export function createMediaRouter() {
  const router = express.Router();

  // 1. Quota & Cloudinary server readiness check (never exposes API secret or key)
  router.get('/status', readLimiter, requireFirebaseAuth, async (_req: AuthedRequest, res: Response) => {
    try {
      const report = await getMediaQuotaReport();
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Impossible de vérifier l’état Cloudinary.',
      });
    }
  });

  // 2. Authenticated Image Upload (products/{uid}/{productId}, stores/{uid}, profiles/{uid})
  router.post(
    '/upload',
    writeLimiter,
    requireFirebaseAuth,
    handleSingleFileUpload,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      try {
        if (!isCloudinaryConfigured()) {
          res.status(503).json({
            error:
              'Cloudinary n’est pas encore configuré côté serveur (variables CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET requises).',
          });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: 'Aucun fichier image fourni.' });
          return;
        }

        const validated = validateUploadedImageFile(req.file);
        const scope = String(req.body?.scope || 'product');
        const productId = String(req.body?.productId || '').trim();
        const storeId = String(req.body?.storeId || '').trim();
        const autoPersist = String(req.body?.autoPersist || 'false') === 'true';

        let folder = '';
        let existingProduct: Record<string, unknown> | null = null;
        let existingImages: ServerProductImageMeta[] = [];

        if (scope === 'product') {
          if (!isValidEntityId(productId)) {
            res.status(400).json({ error: 'Identifiant produit invalide.' });
            return;
          }

          existingProduct = await fetchFirestoreDoc('products', productId, user.idToken);
          if (existingProduct) {
            if (String(existingProduct.sellerId || '') !== user.uid) {
              res.status(403).json({
                error: 'Accès refusé : vous n’êtes pas le propriétaire de ce produit.',
              });
              return;
            }
            existingImages = parseProductImagesFromDoc(existingProduct);
            if (existingImages.length >= CLOUDINARY_FREE_LIMITS.maxPhotosPerProduct) {
              res.status(400).json({
                error: `Limite maximale atteinte : ${CLOUDINARY_FREE_LIMITS.maxPhotosPerProduct} photos par produit.`,
              });
              return;
            }
          } else {
            // Draft product: confirm caller owns a non-suspended store
            const stores = await fetchOwnerStores(user.uid, user.idToken);
            const activeStore = stores.find((s) => String(s.verificationStatus || '') !== 'suspended');
            if (!activeStore) {
              res.status(403).json({
                error: 'Vous devez posséder une boutique active pour importer des photos de produit.',
              });
              return;
            }
          }

          folder = `products/${user.uid}/${productId}`;
        } else if (scope === 'store') {
          if (storeId) {
            if (!isValidEntityId(storeId)) {
              res.status(400).json({ error: 'Identifiant boutique invalide.' });
              return;
            }
            const storeDoc = await fetchFirestoreDoc('stores', storeId, user.idToken);
            if (storeDoc && String(storeDoc.ownerId || '') !== user.uid) {
              res.status(403).json({
                error: 'Accès refusé : vous n’êtes pas le propriétaire de cette boutique.',
              });
              return;
            }
          }
          folder = `stores/${user.uid}`;
        } else if (scope === 'live') {
          const stores = await fetchOwnerStores(user.uid, user.idToken);
          const activeStore = stores.find((s) => String(s.verificationStatus || '') !== 'suspended');
          if (!activeStore) {
            res.status(403).json({
              error: 'Vous devez posséder une boutique active pour importer une image de couverture Live.',
            });
            return;
          }
          folder = `lives/${user.uid}`;
        } else if (scope === 'profile') {
          folder = `profiles/${user.uid}`;
        } else {
          res.status(400).json({ error: 'Portée de téléversement invalide.' });
          return;
        }

        const uploaded = await uploadBufferToCloudinary(req.file.buffer, folder, validated.fileName);
        recordLocalCloudinaryUpload(uploaded.bytes);
        invalidateUsageCache();

        const nowIso = new Date().toISOString();
        const nextOrder = existingImages.length + 1;
        const isPrimary = existingImages.length === 0;

        const meta: ServerProductImageMeta = {
          fileId: uploaded.publicId,
          publicId: uploaded.publicId,
          fileName: validated.fileName,
          ownerId: user.uid,
          url: uploaded.secureUrl,
          isPrimary,
          order: nextOrder,
          uploadedAt: nowIso,
        };

        if (scope === 'product' && existingProduct && autoPersist) {
          const merged = normalizeAndOrderProductImages([...existingImages, meta], user.uid);
          await patchFirestoreFields(
            'products',
            productId,
            {
              images: merged.images,
              productImages: merged.productImages,
              updatedAt: nowIso,
            },
            user.idToken,
          );
        }

        const quota = await getMediaQuotaReport();
        res.status(201).json({
          image: meta,
          bytes: uploaded.bytes,
          format: uploaded.format || validated.format,
          width: uploaded.width,
          height: uploaded.height,
          quotaWarning: quota.warningMessage || null,
          warningLevel: quota.warningLevel,
        });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Accès Firestore refusé pour cette ressource.' });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Erreur lors du téléversement.',
        });
      }
    },
  );

  // 3. Retrieve image metadata for an owned product
  router.get(
    '/product/:productId',
    readLimiter,
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const productId = String(req.params.productId || '');
      if (!isValidEntityId(productId)) {
        res.status(400).json({ error: 'Identifiant produit invalide.' });
        return;
      }
      try {
        const productDoc = await fetchFirestoreDoc('products', productId, user.idToken);
        if (!productDoc) {
          res.status(404).json({ error: 'Produit introuvable.' });
          return;
        }
        if (String(productDoc.sellerId || '') !== user.uid) {
          res.status(403).json({
            error: 'Accès refusé : vous ne pouvez consulter les métadonnées que de vos propres produits.',
          });
          return;
        }
        const images = parseProductImagesFromDoc(productDoc);
        res.json({ productId, images });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Accès refusé.' });
          return;
        }
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Erreur lecture des photos produit.',
        });
      }
    },
  );

  // 4. Reorder or change primary photo on an existing owned product
  router.put(
    '/product/:productId/images',
    writeLimiter,
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const productId = String(req.params.productId || '');
      if (!isValidEntityId(productId)) {
        res.status(400).json({ error: 'Identifiant produit invalide.' });
        return;
      }

      try {
        const productDoc = await fetchFirestoreDoc('products', productId, user.idToken);
        if (!productDoc) {
          res.status(404).json({ error: 'Produit introuvable.' });
          return;
        }
        if (String(productDoc.sellerId || '') !== user.uid) {
          res.status(403).json({
            error: 'Accès refusé : vous n’êtes pas le propriétaire de ce produit.',
          });
          return;
        }

        const existing = parseProductImagesFromDoc(productDoc);
        const existingByKey = new Map<string, ServerProductImageMeta>();
        for (const item of existing) {
          if (item.publicId) existingByKey.set(item.publicId, item);
          if (item.fileId) existingByKey.set(item.fileId, item);
          existingByKey.set(item.url, item);
        }

        const incomingList = Array.isArray(req.body?.productImages) ? req.body.productImages : [];
        if (incomingList.length > CLOUDINARY_FREE_LIMITS.maxPhotosPerProduct) {
          res.status(400).json({
            error: `Maximum ${CLOUDINARY_FREE_LIMITS.maxPhotosPerProduct} photos autorisées par produit.`,
          });
          return;
        }
        if (incomingList.length === 0 && String(productDoc.status || '') !== 'brouillon') {
          res.status(400).json({
            error: 'Un produit publié doit conserver au moins une photo.',
          });
          return;
        }

        const verifiedList: ServerProductImageMeta[] = [];
        for (let i = 0; i < incomingList.length; i++) {
          const row = incomingList[i] as Record<string, unknown>;
          const match =
            existingByKey.get(String(row.publicId || '')) ||
            existingByKey.get(String(row.fileId || '')) ||
            existingByKey.get(String(row.url || ''));

          const ownsScopedPublicId =
            typeof row.publicId === 'string' &&
            row.publicId.startsWith(`products/${user.uid}/${productId}/`);

          if (!match && !ownsScopedPublicId) {
            res.status(403).json({
              error: 'Image non autorisée : impossible d’associer un identifiant externe à ce produit.',
            });
            return;
          }

          verifiedList.push({
            ...(match || {}),
            fileId: String(match?.fileId || row.publicId || row.fileId || `img_${i + 1}`),
            ...(match?.publicId || (ownsScopedPublicId ? String(row.publicId) : undefined)
              ? { publicId: match?.publicId || String(row.publicId) }
              : {}),
            fileName: String(match?.fileName || row.fileName || ''),
            ownerId: user.uid,
            url: String(match?.url || row.url || ''),
            isPrimary: Boolean(row.isPrimary),
            order: i + 1,
            uploadedAt: String(match?.uploadedAt || row.uploadedAt || new Date().toISOString()),
          });
        }

        const normalized = normalizeAndOrderProductImages(verifiedList, user.uid);
        await patchFirestoreFields(
          'products',
          productId,
          {
            images: normalized.images,
            productImages: normalized.productImages,
            updatedAt: new Date().toISOString(),
          },
          user.idToken,
        );

        res.json(normalized);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Erreur lors de la mise à jour des photos.',
        });
      }
    },
  );

  // 5. Secure Photo Replacement (upload new -> verify -> update Firestore -> delete old)
  router.post(
    '/product/:productId/replace',
    writeLimiter,
    requireFirebaseAuth,
    handleSingleFileUpload,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const productId = String(req.params.productId || '');
      if (!isValidEntityId(productId)) {
        res.status(400).json({ error: 'Identifiant produit invalide.' });
        return;
      }

      try {
        if (!isCloudinaryConfigured()) {
          res.status(503).json({ error: 'Cloudinary n’est pas configuré sur le serveur.' });
          return;
        }
        if (!req.file) {
          res.status(400).json({ error: 'Aucun fichier image de remplacement fourni.' });
          return;
        }

        const validated = validateUploadedImageFile(req.file);
        const targetPublicId = String(req.body?.targetPublicId || '').trim();
        const targetFileId = String(req.body?.targetFileId || '').trim();

        const existingProduct = await fetchFirestoreDoc('products', productId, user.idToken);
        let verifiedOldPublicId = '';
        let existingList: ServerProductImageMeta[] = [];
        let targetIndex = -1;

        if (existingProduct) {
          if (String(existingProduct.sellerId || '') !== user.uid) {
            res.status(403).json({
              error: 'Accès refusé : vous n’êtes pas le propriétaire de ce produit.',
            });
            return;
          }
          existingList = parseProductImagesFromDoc(existingProduct);
          targetIndex = existingList.findIndex(
            (p) =>
              (targetPublicId && p.publicId === targetPublicId) ||
              (targetFileId && p.fileId === targetFileId),
          );
          if (targetIndex === -1) {
            res.status(404).json({
              error: 'Photo cible introuvable dans ce produit. Remplacement refusé.',
            });
            return;
          }
          const matched = existingList[targetIndex];
          if (matched.publicId && matched.publicId.startsWith(`products/${user.uid}/`)) {
            verifiedOldPublicId = matched.publicId;
          }
        } else {
          // Draft product (not yet created in Firestore)
          const stores = await fetchOwnerStores(user.uid, user.idToken);
          if (!stores.some((s) => String(s.verificationStatus || '') !== 'suspended')) {
            res.status(403).json({ error: 'Boutique active requise.' });
            return;
          }
          if (targetPublicId) {
            if (!targetPublicId.startsWith(`products/${user.uid}/${productId}/`)) {
              res.status(403).json({
                error: 'Accès refusé : cette image n’appartient pas à votre produit en cours.',
              });
              return;
            }
            verifiedOldPublicId = targetPublicId;
          }
        }

        // Step 1 & 2: Upload and confirm new image BEFORE modifying or deleting old image
        const folder = `products/${user.uid}/${productId}`;
        const uploaded = await uploadBufferToCloudinary(req.file.buffer, folder, validated.fileName);
        recordLocalCloudinaryUpload(uploaded.bytes);
        invalidateUsageCache();

        const nowIso = new Date().toISOString();
        const oldMeta = targetIndex >= 0 ? existingList[targetIndex] : null;
        const newMeta: ServerProductImageMeta = {
          fileId: uploaded.publicId,
          publicId: uploaded.publicId,
          fileName: validated.fileName,
          ownerId: user.uid,
          url: uploaded.secureUrl,
          isPrimary: oldMeta ? oldMeta.isPrimary : false,
          order: oldMeta ? oldMeta.order : 1,
          uploadedAt: nowIso,
        };

        // Step 3: Update Firestore first if product exists
        let updatedPayload: { images: string[]; productImages: ServerProductImageMeta[] } | null = null;
        if (existingProduct && targetIndex >= 0) {
          const nextList = [...existingList];
          nextList[targetIndex] = newMeta;
          updatedPayload = normalizeAndOrderProductImages(nextList, user.uid);
          await patchFirestoreFields(
            'products',
            productId,
            {
              images: updatedPayload.images,
              productImages: updatedPayload.productImages,
              updatedAt: nowIso,
            },
            user.idToken,
          );
        }

        // Step 4: Destroy old image only after confirmation of new image + Firestore update
        if (verifiedOldPublicId && verifiedOldPublicId !== uploaded.publicId) {
          await destroyCloudinaryPublicId(verifiedOldPublicId).catch(() => {});
        }

        res.json({
          image: newMeta,
          ...(updatedPayload ? updatedPayload : {}),
        });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Accès refusé.' });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Erreur lors du remplacement de la photo.',
        });
      }
    },
  );

  // 6. Secure Single Image Deletion (verifies ownership & Firestore membership first)
  router.post(
    '/delete',
    writeLimiter,
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      try {
        const scope = String(req.body?.scope || 'product');
        const productId = String(req.body?.productId || '').trim();
        const targetPublicId = String(req.body?.publicId || '').trim();
        const targetFileId = String(req.body?.fileId || '').trim();

        if (scope === 'product') {
          if (!isValidEntityId(productId)) {
            res.status(400).json({ error: 'Identifiant produit invalide.' });
            return;
          }

          const existingProduct = await fetchFirestoreDoc('products', productId, user.idToken);
          if (existingProduct) {
            if (String(existingProduct.sellerId || '') !== user.uid) {
              res.status(403).json({
                error: 'Accès refusé : vous n’êtes pas le propriétaire de ce produit.',
              });
              return;
            }

            const existingList = parseProductImagesFromDoc(existingProduct);
            const targetIdx = existingList.findIndex(
              (p) =>
                (targetPublicId && p.publicId === targetPublicId) ||
                (targetFileId && p.fileId === targetFileId),
            );
            if (targetIdx === -1) {
              res.status(404).json({
                error: 'Cette image n’appartient pas au produit spécifié.',
              });
              return;
            }

            if (existingList.length <= 1 && String(existingProduct.status || '') !== 'brouillon') {
              res.status(400).json({
                error:
                  'Un produit publié doit conserver au moins 1 photo. Utilisez « Remplacer » ou passez le produit en Brouillon.',
              });
              return;
            }

            const targetItem = existingList[targetIdx];
            const verifiedPublicId =
              targetItem.publicId && targetItem.publicId.startsWith(`products/${user.uid}/`)
                ? targetItem.publicId
                : '';

            if (verifiedPublicId) {
              await destroyCloudinaryPublicId(verifiedPublicId);
            }

            const remaining = existingList.filter((_, idx) => idx !== targetIdx);
            const normalized = normalizeAndOrderProductImages(remaining, user.uid);
            await patchFirestoreFields(
              'products',
              productId,
              {
                images: normalized.images,
                productImages: normalized.productImages,
                updatedAt: new Date().toISOString(),
              },
              user.idToken,
            );

            res.json({ deleted: true, ...normalized });
            return;
          }

          // Unsaved draft upload: allow deleting ONLY inside caller's own scoped draft folder
          if (!targetPublicId || !targetPublicId.startsWith(`products/${user.uid}/${productId}/`)) {
            res.status(403).json({
              error: 'Suppression refusée : vous ne pouvez supprimer que vos propres brouillons.',
            });
            return;
          }
          await destroyCloudinaryPublicId(targetPublicId);
          res.json({ deleted: true });
          return;
        }

        if (scope === 'store') {
          if (!targetPublicId || !targetPublicId.startsWith(`stores/${user.uid}/`)) {
            res.status(403).json({ error: 'Accès refusé pour ce média boutique.' });
            return;
          }
          await destroyCloudinaryPublicId(targetPublicId);
          res.json({ deleted: true });
          return;
        }

        if (scope === 'live') {
          if (!targetPublicId || !targetPublicId.startsWith(`lives/${user.uid}/`)) {
            res.status(403).json({ error: 'Accès refusé pour cette image de couverture Live.' });
            return;
          }
          await destroyCloudinaryPublicId(targetPublicId);
          res.json({ deleted: true });
          return;
        }

        if (scope === 'profile') {
          if (!targetPublicId || !targetPublicId.startsWith(`profiles/${user.uid}/`)) {
            res.status(403).json({ error: 'Accès refusé pour cette photo de profil.' });
            return;
          }
          await destroyCloudinaryPublicId(targetPublicId);
          res.json({ deleted: true });
          return;
        }

        res.status(400).json({ error: 'Portée de suppression invalide.' });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Accès refusé.' });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Erreur lors de la suppression.',
        });
      }
    },
  );

  // 7. Delete all Cloudinary images belonging to a product owned by caller
  router.delete(
    '/product/:productId/all',
    writeLimiter,
    requireFirebaseAuth,
    async (req: AuthedRequest, res: Response) => {
      const user = req.authUser!;
      const productId = String(req.params.productId || '');
      if (!isValidEntityId(productId)) {
        res.status(400).json({ error: 'Identifiant produit invalide.' });
        return;
      }

      try {
        const productDoc = await fetchFirestoreDoc('products', productId, user.idToken);
        if (!productDoc) {
          res.json({ deletedCount: 0 });
          return;
        }
        if (String(productDoc.sellerId || '') !== user.uid) {
          res.status(403).json({
            error: 'Accès refusé : vous n’êtes pas le propriétaire de ce produit.',
          });
          return;
        }

        const images = parseProductImagesFromDoc(productDoc);
        const ownedPublicIds = images
          .map((m) => m.publicId || '')
          .filter((pid) => pid.startsWith(`products/${user.uid}/`));

        await Promise.all(ownedPublicIds.map((pid) => destroyCloudinaryPublicId(pid).catch(() => {})));
        res.json({ deletedCount: ownedPublicIds.length });
      } catch (err) {
        if (String(err).includes('FIRESTORE_FORBIDDEN')) {
          res.status(403).json({ error: 'Accès refusé.' });
          return;
        }
        res.status(500).json({
          error: err instanceof Error ? err.message : 'Erreur suppression des médias produit.',
        });
      }
    },
  );

  return router;
}
