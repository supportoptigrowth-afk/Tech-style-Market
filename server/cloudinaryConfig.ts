import { v2 as cloudinary } from 'cloudinary';
import fs from 'node:fs';
import path from 'node:path';

export const CLOUDINARY_FREE_LIMITS = {
  maxFileSizeBytes: 5 * 1024 * 1024, // 5 Mo
  maxPhotosPerProduct: 8,
  monthlyCreditsLimit: 25, // Offre gratuite Cloudinary : 25 crédits / mois (non illimitée)
  monthlyBandwidthBytesLimit: 25 * 1024 * 1024 * 1024, // 25 Go / mois
  storageBytesLimit: 25 * 1024 * 1024 * 1024, // 25 Go stockage
  warnThresholdRatio: 0.75,
  criticalThresholdRatio: 0.9,
} as const;

interface LocalUsageCounters {
  monthKey: string;
  uploadsCount: number;
  deletesCount: number;
  uploadedBytes: number;
  lastUpdatedAt: string;
}

const USAGE_FILE = path.resolve(process.cwd(), 'data', 'cloudinary-usage.json');

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

function readLocalCounters(): LocalUsageCounters {
  const monthKey = currentMonthKey();
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8')) as Partial<LocalUsageCounters>;
      if (parsed.monthKey === monthKey) {
        return {
          monthKey,
          uploadsCount: Number(parsed.uploadsCount || 0),
          deletesCount: Number(parsed.deletesCount || 0),
          uploadedBytes: Number(parsed.uploadedBytes || 0),
          lastUpdatedAt: String(parsed.lastUpdatedAt || new Date().toISOString()),
        };
      }
    }
  } catch {
    // Fallback cleanly if file unreadable
  }
  return {
    monthKey,
    uploadsCount: 0,
    deletesCount: 0,
    uploadedBytes: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function writeLocalCounters(counters: LocalUsageCounters): void {
  try {
    const dir = path.dirname(USAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(USAGE_FILE, JSON.stringify(counters, null, 2));
  } catch {
    // Non-fatal in read-only filesystems
  }
}

export function recordLocalCloudinaryUpload(bytes: number): LocalUsageCounters {
  const counters = readLocalCounters();
  counters.uploadsCount += 1;
  counters.uploadedBytes += Math.max(0, Math.round(bytes));
  counters.lastUpdatedAt = new Date().toISOString();
  writeLocalCounters(counters);
  return counters;
}

export function recordLocalCloudinaryDelete(): LocalUsageCounters {
  const counters = readLocalCounters();
  counters.deletesCount += 1;
  counters.lastUpdatedAt = new Date().toISOString();
  writeLocalCounters(counters);
  return counters;
}

export function getCloudinaryEnv() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured(): boolean {
  const { cloudName, apiKey, apiSecret } = getCloudinaryEnv();
  return Boolean(cloudName && apiKey && apiSecret);
}

export function configureCloudinary(): typeof cloudinary {
  const { cloudName, apiKey, apiSecret } = getCloudinaryEnv();
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }
  return cloudinary;
}

export interface MediaQuotaReport {
  configured: boolean;
  cloudNameConfigured: boolean;
  planLabel: string;
  limits: {
    maxFileSizeBytes: number;
    maxPhotosPerProduct: number;
    monthlyCreditsLimit: number;
  };
  localMonthly: LocalUsageCounters;
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

let cachedUsage: { data: MediaQuotaReport['cloudinaryUsage']; expiresAt: number } | null = null;

export async function getMediaQuotaReport(): Promise<MediaQuotaReport> {
  const configured = isCloudinaryConfigured();
  const localMonthly = readLocalCounters();

  if (!configured) {
    return {
      configured: false,
      cloudNameConfigured: Boolean(getCloudinaryEnv().cloudName),
      planLabel: 'Cloudinary Gratuit (non configuré sur le serveur)',
      limits: {
        maxFileSizeBytes: CLOUDINARY_FREE_LIMITS.maxFileSizeBytes,
        maxPhotosPerProduct: CLOUDINARY_FREE_LIMITS.maxPhotosPerProduct,
        monthlyCreditsLimit: CLOUDINARY_FREE_LIMITS.monthlyCreditsLimit,
      },
      localMonthly,
      cloudinaryUsage: null,
      warningLevel: 'unconfigured',
      warningMessage:
        'Variables serveur CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY et CLOUDINARY_API_SECRET manquantes.',
    };
  }

  let cloudinaryUsage: MediaQuotaReport['cloudinaryUsage'] = null;
  const now = Date.now();
  if (cachedUsage && cachedUsage.expiresAt > now) {
    cloudinaryUsage = cachedUsage.data;
  } else {
    try {
      configureCloudinary();
      const raw = (await cloudinary.api.usage()) as Record<string, unknown>;
      const credits = (raw.credits as Record<string, unknown>) || {};
      const storage = (raw.storage as Record<string, unknown>) || {};
      const bandwidth = (raw.bandwidth as Record<string, unknown>) || {};
      const transformations = (raw.transformations as Record<string, unknown>) || {};
      const objects = (raw.objects as Record<string, unknown>) || {};

      const creditsUsed = Number(credits.usage || 0);
      const creditsLimit = Number(credits.limit || CLOUDINARY_FREE_LIMITS.monthlyCreditsLimit);
      const creditsPercent =
        creditsLimit > 0 ? Math.min(100, Math.round((creditsUsed / creditsLimit) * 1000) / 10) : 0;

      cloudinaryUsage = {
        plan: String(raw.plan || 'Free'),
        creditsUsed,
        creditsLimit,
        creditsPercent,
        storageBytesUsed: Number(storage.usage || 0),
        bandwidthBytesUsed: Number(bandwidth.usage || 0),
        transformationsUsed: Number(transformations.usage || 0),
        objectsCount: Number(objects.usage || 0),
        fetchedAt: new Date().toISOString(),
      };
      cachedUsage = { data: cloudinaryUsage, expiresAt: now + 60_000 };
    } catch {
      cloudinaryUsage = null;
    }
  }

  const ratio =
    cloudinaryUsage && cloudinaryUsage.creditsLimit
      ? (cloudinaryUsage.creditsUsed || 0) / cloudinaryUsage.creditsLimit
      : 0;

  let warningLevel: MediaQuotaReport['warningLevel'] = 'ok';
  let warningMessage = '';

  if (ratio >= CLOUDINARY_FREE_LIMITS.criticalThresholdRatio) {
    warningLevel = 'critical';
    warningMessage = `Alerte quota Cloudinary : ${cloudinaryUsage?.creditsPercent}% des crédits gratuits mensuels utilisés. Limitez les nouveaux imports ou optimisez vos fichiers.`;
  } else if (ratio >= CLOUDINARY_FREE_LIMITS.warnThresholdRatio) {
    warningLevel = 'warning';
    warningMessage = `Attention quota Cloudinary : ${cloudinaryUsage?.creditsPercent}% des crédits gratuits mensuels utilisés.`;
  }

  return {
    configured: true,
    cloudNameConfigured: true,
    planLabel: `Cloudinary ${cloudinaryUsage?.plan || 'Free'} (offre gratuite soumise à quotas)`,
    limits: {
      maxFileSizeBytes: CLOUDINARY_FREE_LIMITS.maxFileSizeBytes,
      maxPhotosPerProduct: CLOUDINARY_FREE_LIMITS.maxPhotosPerProduct,
      monthlyCreditsLimit: cloudinaryUsage?.creditsLimit || CLOUDINARY_FREE_LIMITS.monthlyCreditsLimit,
    },
    localMonthly,
    cloudinaryUsage,
    warningLevel,
    warningMessage,
  };
}

export function invalidateUsageCache(): void {
  cachedUsage = null;
}
