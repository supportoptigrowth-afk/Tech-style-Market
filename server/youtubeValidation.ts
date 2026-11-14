const YOUTUBE_VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

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

export interface ValidatedYouTubeLink {
  videoId: string;
  youtubeUrl: string;
  embedUrl: string;
}

export function extractAndValidateYouTubeUrl(rawInput: string): ValidatedYouTubeLink {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    throw new Error('Veuillez fournir un lien YouTube Live valide.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Le lien saisi n’est pas une URL valide.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('Seuls les liens YouTube en HTTPS/HTTP sont autorisés.');
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_YOUTUBE_HOSTS.has(host)) {
    throw new Error(
      'Domaine non autorisé. Seuls les liens YouTube officiels (youtube.com/watch?v=, youtube.com/live/, youtu.be/ ou youtube.com/embed/) sont acceptés.',
    );
  }

  let candidateId = '';

  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const seg = parsed.pathname.split('/').filter(Boolean)[0] || '';
    candidateId = seg;
  } else {
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments[0] === 'watch') {
      candidateId = parsed.searchParams.get('v') || '';
    } else if (segments[0] === 'live' && segments[1]) {
      candidateId = segments[1];
    } else if (segments[0] === 'embed' && segments[1]) {
      candidateId = segments[1];
    } else if (segments[0] === 'shorts' && segments[1]) {
      throw new Error('Les YouTube Shorts ne sont pas pris en charge pour le Live Shopping.');
    }
  }

  candidateId = candidateId.trim();
  if (!YOUTUBE_VIDEO_ID_REGEX.test(candidateId)) {
    throw new Error(
      'Identifiant vidéo YouTube invalide. Utilisez un lien youtube.com/watch?v=..., youtube.com/live/..., youtu.be/... ou youtube.com/embed/...',
    );
  }

  return {
    videoId: candidateId,
    youtubeUrl: `https://www.youtube.com/watch?v=${candidateId}`,
    embedUrl: `https://www.youtube.com/embed/${candidateId}?rel=0`,
  };
}
