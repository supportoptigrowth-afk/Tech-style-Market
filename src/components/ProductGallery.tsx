import { ChevronLeft, ChevronRight, Expand, X, ZoomIn, ZoomOut } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { optimizeCloudinaryUrl } from '../lib/mediaService';
import { SafeImage } from './SafeImage';

interface ProductGalleryProps {
  images: string[];
  alt: string;
}

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const safeImages = images.filter((u) => typeof u === 'string' && u.trim().length > 0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  useEffect(() => {
    setActiveIdx(0);
    setLightboxOpen(false);
    setZoomed(false);
  }, [images]);

  const count = safeImages.length;

  const goPrev = useCallback(() => {
    if (count <= 1) return;
    setActiveIdx((prev) => (prev - 1 + count) % count);
    setZoomed(false);
  }, [count]);

  const goNext = useCallback(() => {
    if (count <= 1) return;
    setActiveIdx((prev) => (prev + 1) % count);
    setZoomed(false);
  }, [count]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        setZoomed(false);
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, goPrev, goNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.changedTouches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const delta = endX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) goPrev();
    else goNext();
  };

  const currentSrc = safeImages[activeIdx] || safeImages[0] || '';

  return (
    <div className="space-y-4">
      <div
        className="aspect-[4/3] rounded-xl overflow-hidden bg-white border border-slate-200 relative group select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={() => {
            if (currentSrc) setLightboxOpen(true);
          }}
          className={`w-full h-full block ${currentSrc ? 'cursor-zoom-in' : 'cursor-default'}`}
          aria-label={currentSrc ? `Agrandir la photo de ${alt}` : alt}
        >
          <SafeImage src={currentSrc} alt={alt} className="w-full h-full object-cover" />
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Photo précédente"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#0B1528]/80 hover:bg-[#0B1528] text-white flex items-center justify-center transition-opacity opacity-90 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Photo suivante"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-[#0B1528]/80 hover:bg-[#0B1528] text-white flex items-center justify-center transition-opacity opacity-90 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {currentSrc && (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {count > 1 && (
              <span className="px-2.5 py-1 rounded-md bg-[#0B1528]/80 text-white text-xs font-mono tabular-nums">
                {activeIdx + 1} / {count}
              </span>
            )}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0B1528]/80 hover:bg-[#0B1528] text-white text-xs font-medium cursor-pointer"
              aria-label="Ouvrir en plein écran"
            >
              <Expand className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Zoom</span>
            </button>
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5">
          {safeImages.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`aspect-[4/3] rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
                i === activeIdx
                  ? 'border-orange-600 ring-2 ring-orange-600/20'
                  : 'border-slate-200 hover:border-slate-400'
              }`}
              aria-label={`Afficher la photo ${i + 1}`}
            >
              <SafeImage src={img} alt={`${alt} vue ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {lightboxOpen && currentSrc && (
        <div
          className="fixed inset-0 z-50 bg-[#060D1A]/95 flex flex-col justify-between p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Galerie photo : ${alt}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex items-center justify-between text-white">
            <div className="text-xs sm:text-sm font-medium truncate pr-4">
              <span className="font-display font-semibold">{alt}</span>
              {count > 1 && (
                <span className="ml-2 font-mono text-slate-300 tabular-nums">
                  ({activeIdx + 1} / {count})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                {zoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                <span>{zoomed ? 'Taille normale' : 'Zoomer'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLightboxOpen(false);
                  setZoomed(false);
                }}
                aria-label="Fermer la galerie"
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative overflow-auto my-4">
            {count > 1 && (
              <button
                type="button"
                onClick={goPrev}
                aria-label="Photo précédente"
                className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            <img
              src={optimizeCloudinaryUrl(currentSrc, { width: 1600, crop: 'limit' })}
              alt={alt}
              referrerPolicy="no-referrer"
              onClick={() => setZoomed((z) => !z)}
              className={`max-h-[75vh] w-auto object-contain rounded-lg transition-transform duration-200 select-none ${
                zoomed ? 'scale-150 cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              }`}
            />

            {count > 1 && (
              <button
                type="button"
                onClick={goNext}
                aria-label="Photo suivante"
                className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {count > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto pb-1">
              {safeImages.map((img, i) => (
                <button
                  key={`${img}-lb-${i}`}
                  type="button"
                  onClick={() => {
                    setActiveIdx(i);
                    setZoomed(false);
                  }}
                  className={`w-16 h-12 rounded-md overflow-hidden border-2 shrink-0 cursor-pointer ${
                    i === activeIdx ? 'border-orange-500' : 'border-white/20 opacity-70 hover:opacity-100'
                  }`}
                >
                  <SafeImage src={img} alt={`${alt} miniature ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
