import type { ProductImageMeta } from '../types';
import { auth } from './firebase';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export interface MediaQuotaStatus {
  configured: boolean;
  cloudNameConfigured: boolean;
  planLabel: string;
  limits: {
    maxFileSizeBytes: number;
    maxPhotosPerProduct: number;
    monthlyCreditsLimit: number;
  };
  localMonthly: {
    monthKey: string;
    uploadsCount: number;
    deletesCount: number;
    uploadedBytes: number;
    lastUpdatedAt: string;
  };
  cloudinaryUsage: {
    plan?: string;
    creditsUsed?: number;
    creditsLimit?: number;
    creditsPercent?: number;
    storageBytesUsed?: number;
    bandwidthBytesUsed?: number;
    transformationsUsed?: number;
    objectsCount?: number;
    fetchedAt?: string;
  } | null;
  warningLevel: 'ok' | 'warning' | 'critical' | 'unconfigured';
  warningMessage: string;
}

export interface UploadImageResponse {
  image: ProductImageMeta;
  bytes: number;
  format: string;
  width: number;
  height: number;
  quotaWarning: string | null;
  warningLevel: MediaQuotaStatus['warningLevel'];
}

export interface ReplaceImageResponse {
  image: ProductImageMeta;
  images?: string[];
  productImages?: ProductImageMeta[];
}

export function validateImageFile(file: File): void {
  const mime = (file.type || '').toLowerCase();
  const hasAllowedExt = /\.(jpe?g|png|webp)$/i.test(file.name);

  if (!ALLOWED_IMAGE_MIME_TYPES.has(mime) && !(mime === '' && hasAllowedExt)) {
    throw new Error(
      `Format non accepté pour « ${file.name} ». Formats autorisés : JPG, JPEG, PNG et WEBP.`,
    );
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Le fichier « ${file.name} » fait ${sizeMb} Mo (limite maximale : 5 Mo par photo).`,
    );
  }
}

/**
 * Optimizes Cloudinary HTTPS delivery URLs with automatic format & quality (f_auto,q_auto)
 * and optional responsive width resizing without affecting non-Cloudinary URLs.
 */
export function optimizeCloudinaryUrl(
  url?: string | null,
  options?: { width?: number; height?: number; crop?: 'limit' | 'fill' },
): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed.includes('res.cloudinary.com') || !trimmed.includes('/image/upload/')) {
    return trimmed;
  }

  const marker = '/image/upload/';
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return trimmed;

  const prefix = trimmed.slice(0, idx + marker.length);
  const rest = trimmed.slice(idx + marker.length);

  // Avoid double-injecting transformations if already present
  const firstSegment = rest.split('/')[0] || '';
  if (firstSegment.includes('f_auto') || firstSegment.includes('q_auto')) {
    return trimmed;
  }

  const parts = ['f_auto', 'q_auto'];
  if (options?.width) {
    parts.push(`w_${options.width}`);
    if (options.height) parts.push(`h_${options.height}`);
    parts.push(`c_${options.crop || 'limit'}`);
    if (options.crop === 'fill') parts.push('g_auto');
  }

  return `${prefix}${parts.join(',')}/${rest}`;
}

export async function optimizeImageBeforeUpload(file: File): Promise<File> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return file;
  }
  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Impossible de lire l’image.'));
        el.src = objectUrl;
      });

      const maxDim = 1600;
      const ratio = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const targetW = Math.max(1, Math.round(img.width * ratio));
      const targetH = Math.max(1, Math.round(img.height * ratio));

      if (ratio === 1 && file.size <= 220 * 1024) {
        return file;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;

      ctx.drawImage(img, 0, 0, targetW, targetH);

      const targetMime =
        file.type === 'image/png' ? 'image/webp' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
      const ext = targetMime === 'image/webp' ? 'webp' : 'jpg';

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), targetMime, 0.85);
      });

      if (!blob || blob.size >= file.size) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'photo';
      return new File([blob], `${baseName}.${ext}`, { type: targetMime });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return file;
  }
}

async function getBearerToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentification requise pour gérer vos images.');
  }
  return await user.getIdToken();
}

function sendMultipartWithProgress<T>(
  endpoint: string,
  formData: FormData,
  token: string,
  onProgress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        const pct = Math.min(96, Math.round((evt.loaded / evt.total) * 95));
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(xhr.responseText || '{}') as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(parsed as T);
      } else {
        const msg =
          typeof parsed.error === 'string' && parsed.error
            ? parsed.error
            : `Échec du téléversement (code HTTP ${xhr.status}).`;
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Erreur réseau pendant le téléversement vers le serveur.'));
    };

    xhr.onabort = () => {
      reject(new Error('Téléversement annulé.'));
    };

    xhr.send(formData);
  });
}

export async function uploadImageWithProgress(
  file: File,
  options: {
    scope: 'product' | 'store' | 'profile' | 'live';
    productId?: string;
    storeId?: string;
    autoPersist?: boolean;
  },
  onProgress?: (percent: number) => void,
): Promise<UploadImageResponse> {
  validateImageFile(file);
  const token = await getBearerToken();
  const optimized = await optimizeImageBeforeUpload(file);

  const formData = new FormData();
  formData.append('scope', options.scope);
  if (options.productId) formData.append('productId', options.productId);
  if (options.storeId) formData.append('storeId', options.storeId);
  if (options.autoPersist) formData.append('autoPersist', 'true');
  formData.append('image', optimized);

  return await sendMultipartWithProgress<UploadImageResponse>(
    '/api/media/upload',
    formData,
    token,
    onProgress,
  );
}

export async function uploadSimpleMediaImage(
  file: File,
  scope: 'store' | 'profile' | 'live',
  storeId?: string,
): Promise<ProductImageMeta> {
  const res = await uploadImageWithProgress(file, { scope, storeId });
  return res.image;
}

export async function replaceProductPhotoWithProgress(
  productId: string,
  target: { publicId?: string; fileId?: string },
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ReplaceImageResponse> {
  validateImageFile(file);
  const token = await getBearerToken();
  const optimized = await optimizeImageBeforeUpload(file);

  const formData = new FormData();
  if (target.publicId) formData.append('targetPublicId', target.publicId);
  if (target.fileId) formData.append('targetFileId', target.fileId);
  formData.append('image', optimized);

  return await sendMultipartWithProgress<ReplaceImageResponse>(
    `/api/media/product/${encodeURIComponent(productId)}/replace`,
    formData,
    token,
    onProgress,
  );
}

export async function deleteMediaImage(params: {
  scope: 'product' | 'store' | 'profile' | 'live';
  productId?: string;
  publicId?: string;
  fileId?: string;
}): Promise<{ deleted: boolean; images?: string[]; productImages?: ProductImageMeta[] }> {
  const token = await getBearerToken();
  const res = await fetch('/api/media/delete', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Impossible de supprimer cette photo.',
    );
  }
  return data as { deleted: boolean; images?: string[]; productImages?: ProductImageMeta[] };
}

export async function updateProductImagesOrder(
  productId: string,
  productImages: ProductImageMeta[],
): Promise<{ images: string[]; productImages: ProductImageMeta[] }> {
  const token = await getBearerToken();
  const res = await fetch(`/api/media/product/${encodeURIComponent(productId)}/images`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ productImages }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === 'string'
        ? data.error
        : 'Impossible de mettre à jour l’ordre des photos.',
    );
  }
  return data as { images: string[]; productImages: ProductImageMeta[] };
}

export async function deleteAllProductMedia(productId: string): Promise<void> {
  try {
    const token = await getBearerToken();
    await fetch(`/api/media/product/${encodeURIComponent(productId)}/all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Non-fatal cleanup if server cleanup cannot run
  }
}

export async function fetchMediaQuotaStatus(): Promise<MediaQuotaStatus | null> {
  try {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken();
    const res = await fetch('/api/media/status', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as MediaQuotaStatus;
  } catch {
    return null;
  }
}
