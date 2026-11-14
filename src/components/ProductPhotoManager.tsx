import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Cloud,
  FolderOpen,
  ImagePlus,
  RefreshCw,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteMediaImage,
  fetchMediaQuotaStatus,
  replaceProductPhotoWithProgress,
  updateProductImagesOrder,
  uploadImageWithProgress,
  validateImageFile,
  type MediaQuotaStatus,
} from '../lib/mediaService';
import type { ProductImageMeta } from '../types';
import { SafeImage } from './SafeImage';

const MAX_PHOTOS = 8;

interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: 'uploading' | 'error';
  error?: string;
  replaceIndex?: number;
  replaceTarget?: { publicId?: string; fileId?: string };
}

interface ProductPhotoManagerProps {
  userId: string;
  productId: string;
  isExistingProduct?: boolean;
  photos: ProductImageMeta[];
  onChange: (nextPhotos: ProductImageMeta[]) => void;
  onStatusMessage?: (text: string, tone: 'success' | 'error' | 'info') => void;
}

function normalizePhotoOrder(list: ProductImageMeta[]): ProductImageMeta[] {
  if (list.length === 0) return [];
  const hasPrimary = list.some((p) => p.isPrimary);
  return list.map((p, idx) => ({
    ...p,
    order: idx + 1,
    isPrimary: hasPrimary ? p.isPrimary : idx === 0,
  }));
}

export function ProductPhotoManager({
  userId,
  productId,
  isExistingProduct = false,
  photos,
  onChange,
  onStatusMessage,
}: ProductPhotoManagerProps) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [validationError, setValidationError] = useState('');
  const [successNote, setSuccessNote] = useState('');
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [quota, setQuota] = useState<MediaQuotaStatus | null>(null);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetIdxRef = useRef<number | null>(null);
  const photosRef = useRef<ProductImageMeta[]>(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const refreshQuota = useCallback(() => {
    void fetchMediaQuotaStatus().then((q) => {
      if (q) setQuota(q);
    });
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  useEffect(() => {
    return () => {
      setQueue((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return prev;
      });
    };
  }, []);

  const performUpload = async (queueItem: UploadQueueItem) => {
    setSuccessNote('');
    setQueue((prev) =>
      prev.map((q) =>
        q.id === queueItem.id ? { ...q, status: 'uploading', progress: 0, error: undefined } : q,
      ),
    );

    try {
      const replaceIdx = queueItem.replaceIndex;
      if (typeof replaceIdx === 'number' && queueItem.replaceTarget) {
        const res = await replaceProductPhotoWithProgress(
          productId,
          queueItem.replaceTarget,
          queueItem.file,
          (percent) => {
            setQueue((prev) =>
              prev.map((q) => (q.id === queueItem.id ? { ...q, progress: percent } : q)),
            );
          },
        );

        if (Array.isArray(res.productImages) && res.productImages.length > 0) {
          onChange(res.productImages);
        } else {
          const currentList = [...photosRef.current];
          if (replaceIdx >= 0 && replaceIdx < currentList.length) {
            const old = currentList[replaceIdx];
            currentList[replaceIdx] = {
              ...res.image,
              ownerId: userId,
              isPrimary: old.isPrimary,
              order: replaceIdx + 1,
            };
            onChange(normalizePhotoOrder(currentList));
          }
        }
        setSuccessNote('Photo remplacée avec succès sur Cloudinary.');
        onStatusMessage?.('Photo remplacée avec succès.', 'success');
      } else {
        if (photosRef.current.length >= MAX_PHOTOS) {
          throw new Error(`Limite maximale de ${MAX_PHOTOS} photos atteinte.`);
        }

        const res = await uploadImageWithProgress(
          queueItem.file,
          {
            scope: 'product',
            productId,
            autoPersist: isExistingProduct,
          },
          (percent) => {
            setQueue((prev) =>
              prev.map((q) => (q.id === queueItem.id ? { ...q, progress: percent } : q)),
            );
          },
        );

        const currentList = [...photosRef.current];
        const nextMeta: ProductImageMeta = {
          ...res.image,
          ownerId: userId,
          isPrimary: currentList.length === 0,
          order: currentList.length + 1,
        };
        const updated = normalizePhotoOrder([...currentList, nextMeta]);
        onChange(updated);

        if (res.quotaWarning) {
          onStatusMessage?.(res.quotaWarning, 'info');
        } else {
          onStatusMessage?.('Photo importée sur Cloudinary.', 'success');
        }
        setSuccessNote('Photo importée et optimisée avec succès.');
      }

      URL.revokeObjectURL(queueItem.previewUrl);
      setQueue((prev) => prev.filter((q) => q.id !== queueItem.id));
      refreshQuota();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du téléversement.';
      setQueue((prev) =>
        prev.map((q) => (q.id === queueItem.id ? { ...q, status: 'error', error: message } : q)),
      );
      onStatusMessage?.(message, 'error');
    }
  };

  const enqueueFiles = (fileList: FileList | null, replaceIndex?: number) => {
    if (!fileList || fileList.length === 0) return;
    setValidationError('');
    setSuccessNote('');

    const selected = Array.from(fileList);
    if (replaceIndex === undefined) {
      const activeUploads = queue.filter((q) => q.status === 'uploading').length;
      const remainingSlots = MAX_PHOTOS - photos.length - activeUploads;
      if (remainingSlots <= 0) {
        setValidationError(`Limite maximale atteinte : ${MAX_PHOTOS} photos par produit.`);
        return;
      }
      if (selected.length > remainingSlots) {
        setValidationError(
          `Maximum ${MAX_PHOTOS} photos par produit. Seules les ${remainingSlots} première(s) photo(s) seront importées.`,
        );
      }
    }

    const toProcess =
      replaceIndex !== undefined
        ? selected.slice(0, 1)
        : selected.slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    const errs: string[] = [];

    for (const file of toProcess) {
      try {
        validateImageFile(file);
      } catch (err) {
        errs.push(err instanceof Error ? err.message : `Fichier invalide : ${file.name}`);
        continue;
      }

      const id = `upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const oldPhoto = typeof replaceIndex === 'number' ? photos[replaceIndex] : undefined;
      const item: UploadQueueItem = {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: 'uploading',
        replaceIndex,
        replaceTarget: oldPhoto
          ? { publicId: oldPhoto.publicId, fileId: oldPhoto.fileId }
          : undefined,
      };
      setQueue((prev) => [...prev, item]);
      void performUpload(item);
    }

    if (errs.length > 0) {
      setValidationError(errs.join(' '));
    }
  };

  const syncOrderWithServerIfNeeded = async (nextList: ProductImageMeta[], feedbackText: string) => {
    const previous = photos;
    onChange(nextList);
    if (isExistingProduct) {
      try {
        const synced = await updateProductImagesOrder(productId, nextList);
        onChange(synced.productImages);
        setSuccessNote(feedbackText);
      } catch (err) {
        onChange(previous);
        const msg = err instanceof Error ? err.message : 'Impossible d’enregistrer l’ordre.';
        setValidationError(msg);
        onStatusMessage?.(msg, 'error');
        return;
      }
    }
    onStatusMessage?.(feedbackText, 'info');
  };

  const handleSetPrimary = (idx: number) => {
    const target = photos[idx];
    if (!target) return;
    const reordered = [
      { ...target, isPrimary: true },
      ...photos.filter((_, i) => i !== idx).map((p) => ({ ...p, isPrimary: false })),
    ].map((p, i) => ({ ...p, order: i + 1 }));
    void syncOrderWithServerIfNeeded(reordered, 'Photo principale mise à jour.');
  };

  const handleMove = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= photos.length) return;
    const copy = [...photos];
    const [moved] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, moved);
    const next = copy.map((p, i) => ({
      ...p,
      order: i + 1,
      isPrimary: i === 0,
    }));
    void syncOrderWithServerIfNeeded(next, 'Ordre des photos mis à jour.');
  };

  const handleRemovePhoto = async (idx: number) => {
    const target = photos[idx];
    if (!target) return;
    setValidationError('');
    setSuccessNote('');
    setBusyIndex(idx);
    try {
      const res = await deleteMediaImage({
        scope: 'product',
        productId,
        publicId: target.publicId,
        fileId: target.fileId,
      });

      if (Array.isArray(res.productImages)) {
        onChange(res.productImages);
      } else {
        const remaining = photos.filter((_, i) => i !== idx);
        if (remaining.length > 0 && !remaining.some((p) => p.isPrimary)) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        onChange(remaining.map((p, i) => ({ ...p, order: i + 1 })));
      }
      setSuccessNote('Photo supprimée de Cloudinary.');
      onStatusMessage?.('Photo supprimée.', 'info');
      refreshQuota();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la suppression.';
      setValidationError(msg);
      onStatusMessage?.(msg, 'error');
    } finally {
      setBusyIndex(null);
    }
  };

  const triggerReplace = (idx: number) => {
    replaceTargetIdxRef.current = idx;
    replaceInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="block text-xs font-semibold text-[#0B1528]">
            Photos du produit ({photos.length} / {MAX_PHOTOS})
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Formats acceptés : JPG, JPEG, PNG, WEBP · Max 5 Mo par fichier · Optimisation
            automatique via Cloudinary.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={photos.length >= MAX_PHOTOS}
            onClick={() => galleryInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B1528] hover:bg-[#132342] disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Galerie / Fichiers</span>
          </button>

          <button
            type="button"
            disabled={photos.length >= MAX_PHOTOS}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-orange-600 text-orange-700 hover:bg-orange-50 disabled:border-slate-200 disabled:text-slate-400 text-xs font-semibold cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Prendre une photo</span>
          </button>
        </div>
      </div>

      {/* Cloudinary Free-Tier Quota Status & Warnings */}
      {quota && (
        <div
          className={`p-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            quota.warningLevel === 'unconfigured' || quota.warningLevel === 'critical'
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : quota.warningLevel === 'warning'
                ? 'bg-orange-50 border-orange-200 text-orange-900'
                : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2">
            {quota.warningLevel === 'ok' ? (
              <Cloud className="w-4 h-4 text-[#0B1528] shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span>
              {quota.warningMessage ||
                `${quota.planLabel} · ${quota.localMonthly.uploadsCount} import(s) ce mois-ci`}
            </span>
          </div>
          {quota.cloudinaryUsage && typeof quota.cloudinaryUsage.creditsPercent === 'number' && (
            <span className="font-mono text-[11px] font-semibold shrink-0 tabular-nums">
              Crédits : {quota.cloudinaryUsage.creditsUsed}/{quota.cloudinaryUsage.creditsLimit} (
              {quota.cloudinaryUsage.creditsPercent}%)
            </span>
          )}
        </div>
      )}

      {/* Hidden inputs for gallery, camera capture, and single-slot replacement */}
      <input
        ref={galleryInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => {
          enqueueFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          enqueueFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const idx = replaceTargetIdxRef.current;
          replaceTargetIdxRef.current = null;
          if (idx !== null) {
            enqueueFiles(e.target.files, idx);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      {validationError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      {successNote && !validationError && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successNote}</span>
        </div>
      )}

      {/* Active Uploads & Errors Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border flex items-center gap-3 ${
                item.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="w-12 h-10 rounded object-cover border border-slate-200 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#0B1528] truncate">{item.file.name}</span>
                  {item.status === 'uploading' && (
                    <span className="font-mono font-semibold text-orange-600 tabular-nums">
                      {item.progress}%
                    </span>
                  )}
                </div>

                {item.status === 'uploading' ? (
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-orange-600 transition-all duration-150"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-red-700 mt-1">{item.error}</p>
                )}
              </div>

              {item.status === 'error' && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void performUpload(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#0B1528] text-white text-[11px] font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Réessayer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(item.previewUrl);
                      setQueue((prev) => prev.filter((q) => q.id !== item.id));
                    }}
                    aria-label="Ignorer cette erreur"
                    className="p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Photo Grid Preview + Reorder + Primary + Replace + Delete */}
      {photos.length === 0 ? (
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50">
          <ImagePlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-[#0B1528]">Aucune photo ajoutée pour ce produit</p>
          <p className="text-xs text-slate-500 mt-1">
            Importez jusqu’à {MAX_PHOTOS} photos depuis votre téléphone ou votre ordinateur.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo, idx) => (
            <div
              key={`${photo.publicId || photo.fileId}-${idx}`}
              className={`rounded-xl border bg-white overflow-hidden flex flex-col ${
                photo.isPrimary ? 'border-orange-600 ring-2 ring-orange-600/15' : 'border-slate-200'
              }`}
            >
              <div className="aspect-[4/3] relative bg-slate-100">
                <SafeImage
                  src={photo.url}
                  alt={photo.fileName || `Photo ${idx + 1}`}
                  optimizeWidth={500}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0B1528]/85 text-white text-[10px] font-mono">
                  #{idx + 1}
                </span>
                {photo.isPrimary && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-semibold">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span>Principale</span>
                  </span>
                )}
              </div>

              <div className="p-2 space-y-1.5 bg-white">
                {!photo.isPrimary && (
                  <button
                    type="button"
                    disabled={busyIndex !== null}
                    onClick={() => handleSetPrimary(idx)}
                    className="w-full py-1 px-2 rounded bg-orange-50 hover:bg-orange-100 text-orange-700 text-[11px] font-semibold cursor-pointer"
                  >
                    Définir principale
                  </button>
                )}

                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || busyIndex !== null}
                      onClick={() => handleMove(idx, -1)}
                      title="Déplacer à gauche"
                      aria-label="Déplacer à gauche"
                      className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === photos.length - 1 || busyIndex !== null}
                      onClick={() => handleMove(idx, 1)}
                      title="Déplacer à droite"
                      aria-label="Déplacer à droite"
                      className="p-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={busyIndex !== null}
                      onClick={() => triggerReplace(idx)}
                      title="Remplacer cette photo"
                      aria-label="Remplacer cette photo"
                      className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-[#0B1528] hover:bg-slate-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={busyIndex !== null}
                      onClick={() => void handleRemovePhoto(idx)}
                      title="Supprimer cette photo"
                      aria-label="Supprimer cette photo"
                      className="p-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
