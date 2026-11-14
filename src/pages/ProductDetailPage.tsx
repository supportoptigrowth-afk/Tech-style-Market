import {
  ArrowLeft,
  CheckCircle2,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  MessageSquare,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Store,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { buildWhatsappOrderUrl, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import {
  createReportDoc,
  createReviewDoc,
  fetchProductDetails,
  sendDirectMessageDoc,
} from '../lib/firestoreService';
import type { Product, Review, Shop } from '../types';
import { ProductGallery } from '../components/ProductGallery';
import { SafeImage } from '../components/SafeImage';
import { SocialShareBar } from '../components/SocialShareBar';

export function ProductDetailPage({ productId }: { productId: string }) {
  const { navigate, addToCart, toggleFavorite, user, showToast } = useApp();
  const [product, setProduct] = useState<Product | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Review & Report forms
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchProductDetails(productId)
      .then((res) => {
        setProduct(res.product);
        setShop(res.shop);
        setReviews(res.reviews);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Produit introuvable.'))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-3">Produit introuvable</h1>
        <p className="text-sm text-slate-600 mb-6">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/catalogue')}
          className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Retour au catalogue
        </button>
      </div>
    );
  }

  const activePrice =
    product.promoPrice && product.promoPrice < product.price ? product.promoPrice : product.price;
  const hasPromo = Boolean(product.promoPrice && product.promoPrice < product.price);
  const inStock = product.stock > 0 && product.status === 'disponible';
  const isFav = Boolean(user?.favorites.includes(product.id));

  const productUrl = `${window.location.origin}/produit/${product.id}`;
  const wa = buildWhatsappOrderUrl({
    whatsappNumber: shop?.whatsappNumber,
    productName: product.name,
    price: activePrice,
    reference: product.reference,
    productUrl,
    quantity: qty,
  });

  const handleContactVendor = async () => {
    if (!user) {
      showToast('Connectez-vous pour écrire au vendeur.', 'info');
      navigate('/connexion');
      return;
    }
    if (!shop) return;
    try {
      await sendDirectMessageDoc({
        sender: user,
        shop,
        productId: product.id,
        text: `Bonjour, je suis intéressé par "${product.name}" (Réf : ${product.reference}).`,
      });
      navigate('/messagerie');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur messagerie.', 'error');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/connexion');
      return;
    }
    setSubmittingReview(true);
    try {
      const review = await createReviewDoc({
        productId: product.id,
        storeId: product.shopId,
        user,
        rating,
        comment,
      });
      setReviews((prev) => [review, ...prev]);
      setComment('');
      showToast('Merci pour votre avis !', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de l’envoi.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/connexion');
      return;
    }
    try {
      await createReportDoc({
        reporter: user,
        targetType: 'product',
        targetId: product.id,
        targetLabel: product.name,
        reason: reportReason,
      });
      setReportOpen(false);
      setReportReason('');
      showToast('Signalement transmis à la modération.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => navigate('/catalogue')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0B1528] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour au catalogue</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left Sticky Interactive Gallery */}
        <div className="lg:col-span-7">
          <ProductGallery images={product.images} alt={product.name} />
        </div>

        {/* Right Contiguous Purchase Module */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>{product.category}</span>
            <span className="font-mono">Réf : {product.reference}</span>
          </div>

          <h1 className="font-display font-bold text-2xl text-[#0B1528] leading-snug">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-3">
            <span className="font-mono font-bold text-2xl text-[#0B1528] tabular-nums">
              {formatFCFA(activePrice)}
            </span>
            {hasPromo && (
              <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                {formatFCFA(product.price)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-3 border-y border-slate-100">
            <span className={`font-semibold ${inStock ? 'text-emerald-700' : 'text-red-600'}`}>
              {inStock ? `Disponible (${product.stock} en stock)` : 'Rupture de stock'}
            </span>
            <div className="flex items-center gap-3 text-slate-600">
              {product.condition && (
                <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-[#0B1528]">
                  État : {product.condition}
                </span>
              )}
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{product.city}</span>
              </span>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {product.description}
          </p>

          {product.additionalInfo && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-[#0B1528]">Informations complémentaires</p>
              <p className="whitespace-pre-line leading-relaxed">{product.additionalInfo}</p>
            </div>
          )}

          {/* Quantity + Double Purchase Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Quantité</span>
              <div className="inline-flex items-center border border-slate-200 rounded-lg">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="p-2 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                  aria-label="Diminuer la quantité"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-4 text-sm font-mono font-semibold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  className="p-2 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                  aria-label="Augmenter la quantité"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Option A: Achat direct sur le site */}
            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart(product.id, qty)}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#0B1528] hover:bg-[#132342] disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Ajouter au panier (Paiement à la livraison)</span>
            </button>

            {/* Option B: Commander sur WhatsApp */}
            <a
              href={wa.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Commander sur WhatsApp ({wa.displayNumber})</span>
            </a>

            {wa.usedFallback && (
              <p className="text-[11px] text-slate-500 text-center">
                Cette boutique n’ayant pas renseigné de WhatsApp, la commande est dirigée vers le
                contact officiel TECH STYLE MARKET.
              </p>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleFavorite(product.id)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                  isFav
                    ? 'border-orange-600 text-orange-600 bg-orange-50'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                <span>{isFav ? 'Dans vos favoris' : 'Ajouter aux favoris'}</span>
              </button>

              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 text-xs font-medium cursor-pointer"
                title="Signaler ce produit"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Signaler</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <SocialShareBar
                url={productUrl}
                shareText={`Découvrez "${product.name}" à ${formatFCFA(activePrice)} sur TECH STYLE MARKET (Réf : ${product.reference}) :`}
                label="Partager ce produit"
              />
            </div>
          </div>

          {reportOpen && (
            <form onSubmit={handleReport} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <textarea
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Motif du signalement..."
                rows={2}
                className="w-full p-2 text-xs border border-slate-200 rounded-md bg-white"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                Envoyer le signalement
              </button>
            </form>
          )}

          {/* Vendor Box */}
          {shop && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-200 shrink-0">
                    <SafeImage src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display font-semibold text-sm text-[#0B1528] truncate">
                        {shop.name}
                      </span>
                      {shop.verifiedStatus === 'verified' && (
                        <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{shop.city}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/boutique/${shop.slug}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B1528] hover:text-orange-600 cursor-pointer shrink-0"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>Boutique</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleContactVendor}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white border border-slate-200 hover:border-[#0B1528] text-xs font-semibold text-[#0B1528] cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Contacter le vendeur par messagerie</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <section className="mt-14 pt-10 border-t border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <h2 className="font-display font-bold text-xl text-[#0B1528] mb-2">
              Avis clients ({reviews.length})
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Partagez votre expérience sur ce produit avec la communauté TECH STYLE MARKET.
            </p>

            <form onSubmit={handleSubmitReview} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Note</label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className="p-1 cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          n <= rating ? 'text-orange-500 fill-orange-500' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Votre commentaire
                </label>
                <textarea
                  required
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Qualité, conformité, livraison..."
                  className="w-full p-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer"
              >
                {submittingReview ? 'Publication...' : 'Publier mon avis'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                Aucun avis publié pour ce produit pour l’instant.
              </div>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-display font-semibold text-sm text-[#0B1528]">
                      {rev.userName}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(rev.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-3.5 h-3.5 ${
                          n <= rev.rating ? 'text-orange-500 fill-orange-500' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-slate-700">{rev.comment}</p>
                  {rev.vendorReply && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                      <span className="font-semibold text-[#0B1528]">Réponse du vendeur : </span>
                      {rev.vendorReply}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
