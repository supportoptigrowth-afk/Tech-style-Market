export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 Mo

export type ValidImageFormat = 'jpeg' | 'png' | 'webp';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Inspects actual file header magic bytes rather than trusting browser MIME headers.
 */
export function detectRealImageFormat(buffer: Buffer): ValidImageFormat | null {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG / JPG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WEBP: "RIFF" (0..3) + "WEBP" (8..11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  return null;
}

export function sanitizeImageFilename(originalName: string): string {
  const trimmed = (originalName || 'photo.jpg').trim();
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
  return cleaned.slice(-80) || 'photo.jpg';
}

export function validateUploadedImageFile(file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): { format: ValidImageFormat; fileName: string } {
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw new Error('Aucun fichier image valide reçu par le serveur.');
  }

  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    const mb = (Math.max(file.size, file.buffer.length) / (1024 * 1024)).toFixed(2);
    throw new Error(`Le fichier dépasse la limite autorisée de 5 Mo (${mb} Mo reçus).`);
  }

  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(file.originalname || '');
  const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';
  const mime = (file.mimetype || '').toLowerCase();

  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Extension de fichier non autorisée (${ext}). Formats acceptés : JPG, JPEG, PNG et WEBP.`,
    );
  }

  if (mime && mime !== 'application/octet-stream' && !ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error(
      `Type de fichier non accepté (${mime}). Formats autorisés : JPG, JPEG, PNG et WEBP.`,
    );
  }

  const realFormat = detectRealImageFormat(file.buffer);
  if (!realFormat) {
    throw new Error(
      'Contenu de fichier invalide ou corrompu : seuls les vrais fichiers JPG, JPEG, PNG et WEBP sont acceptés.',
    );
  }

  return {
    format: realFormat,
    fileName: sanitizeImageFilename(file.originalname),
  };
}
