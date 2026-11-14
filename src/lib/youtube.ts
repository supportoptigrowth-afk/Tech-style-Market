import type { LiveComment } from '../types';
import { auth } from './firebase';

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;
const ALLOWED_YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export interface ParsedYouTubeLink {
  videoId: string;
  youtubeUrl: string;
  embedUrl: string;
}

/**
 * Strict client-side parser mirroring server rules.
 * NEVER falls back to arbitrary external iframe URLs.
 */
export function parseStrictYouTubeUrl(rawInput?: string | null): ParsedYouTubeLink | null {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_YOUTUBE_HOSTS.has(host)) return null;

    let videoId = '';
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments[0] === 'watch') {
        videoId = parsed.searchParams.get('v') || '';
      } else if (segments[0] === 'live' && segments[1]) {
        videoId = segments[1];
      } else if (segments[0] === 'embed' && segments[1]) {
        videoId = segments[1];
      }
    }

    videoId = videoId.trim();
    if (!YOUTUBE_ID_REGEX.test(videoId)) return null;

    return {
      videoId,
      youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    };
  } catch {
    return null;
  }
}

async function getBearer(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Connexion requise pour effectuer cette action.');
  }
  return await user.getIdToken();
}

export async function validateYouTubeLinkOnServer(youtubeUrl: string): Promise<ParsedYouTubeLink> {
  const token = await getBearer();
  const res = await fetch('/api/lives/validate-youtube', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ youtubeUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Lien YouTube Live invalide.',
    );
  }
  return {
    videoId: String(data.videoId || ''),
    youtubeUrl: String(data.youtubeUrl || ''),
    embedUrl: String(data.embedUrl || ''),
  };
}

export async function attachYouTubeLinkToLiveOnServer(
  liveId: string,
  youtubeUrl: string,
): Promise<ParsedYouTubeLink> {
  const token = await getBearer();
  const res = await fetch(`/api/lives/${encodeURIComponent(liveId)}/youtube`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ youtubeUrl }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Impossible de valider ce lien YouTube pour ce live.',
    );
  }
  return {
    videoId: String(data.videoId || ''),
    youtubeUrl: String(data.youtubeUrl || ''),
    embedUrl: String(data.embedUrl || ''),
  };
}

export async function postLiveCommentViaApi(params: {
  liveId: string;
  text: string;
  userName?: string;
  userAvatar?: string;
  reactionType?: 'comment' | 'question' | 'reaction';
}): Promise<LiveComment> {
  const token = await getBearer();
  const res = await fetch(`/api/lives/${encodeURIComponent(params.liveId)}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: params.text,
      userName: params.userName || '',
      userAvatar: params.userAvatar || '',
      reactionType: params.reactionType || 'comment',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Impossible d’envoyer ce message pour le moment.',
    );
  }
  return data.comment as LiveComment;
}

export async function deleteLiveCommentViaApi(liveId: string, commentId: string): Promise<void> {
  const token = await getBearer();
  const res = await fetch(
    `/api/lives/${encodeURIComponent(liveId)}/comments/${encodeURIComponent(commentId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Impossible de supprimer ce commentaire.',
    );
  }
}
