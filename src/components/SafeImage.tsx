import { Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { optimizeCloudinaryUrl } from '../lib/mediaService';

interface SafeImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  optimizeWidth?: number;
}

export function SafeImage({
  src,
  alt,
  className = '',
  fallbackLabel,
  optimizeWidth = 900,
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = optimizeCloudinaryUrl(src, { width: optimizeWidth, crop: 'limit' });

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Package className="w-8 h-8 text-slate-400 mb-2 shrink-0" strokeWidth={1.5} />
        <span className="text-xs font-medium text-slate-600 line-clamp-2">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
