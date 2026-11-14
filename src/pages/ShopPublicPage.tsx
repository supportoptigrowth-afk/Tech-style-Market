import {
  CheckCircle2,
  Eye,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  MessageSquare,
  Store,
  Users,
  Video,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import {
  LIVE_STATUS_LABELS,
  OFFICIAL_WHATSAPP_DISPLAY,
  OFFICIAL_WHATSAPP_RAW,
  SHOP_STATUS_LABELS,
  normalizeWhatsappNumber,
} from '../constants';
import { useApp } from '../context/AppContext';
import {
  createReportDoc,
  fetchPublicShopDetails,
  fetchPublicStoresWithStats,
  sendDirectMessageDoc,
} from '../lib/firestoreService';
import type { LiveSession, Product, Review, Shop } from '../types';
import { ProductCard } from '../components/ProductCard';
import { SafeImage } from '../components/SafeImage';
import { SocialShareBar } from '../components/SocialShareBar';

export function ShopsDirectoryPage() {
  const { navigate } = useApp();
  const [shops, setShops] = useState<Array<Shop & { productCount?: number; avgRating?: number | null }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicStoresWithStats()
      .then((res) => setShops(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-[#0B1528]">Boutiques de la marketplace</h1>
          <p className="text-sm text-slate-600 mt-1">
            Découvrez les commerçants indépendants et boutiques certifiées sur TECH STYLE MARKET.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/creer-boutique')}
          className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold whitespace-nowrap self-start cursor-pointer"
        >
          Ouvrir ma boutique
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-64 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {shops.map((shop) => (
            <div
              key={shop.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="h-36 bg-[#0B1528] relative">
                <SafeImage src={shop.coverUrl} alt={shop.name} className="w-full h-full object-cover" />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start gap-3 -mt-10 mb-3 relative z-10">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border-2 border-white shadow-md shrink-0">
                    <SafeImage src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="pt-6 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="font-display font-bold text-base text-[#0B1528] truncate">
                        {shop.name}
                      </h2>
                      {shop.verifiedStatus === 'verified' && (
                        <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{shop.city}</span>
                      <span>·</span>
                      <span className="tabular-nums">{shop.productCount ?? 0} produits</span>
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2 mb-5 flex-1">{shop.description}</p>

                <button
                  type="button"
                  onClick={() => navigate(`/boutique/${shop.slug}`)}
                  className="w-full py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer"
                >
                  Visiter la boutique
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShopPublicPage({ slug }: { slug: string }) {
  const { navigate, user, toggleFollowShop, showToast } = useApp();
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    fetchPublicShopDetails(slug)
      .then((res) => {
        setShop(res.shop);
        setProducts(res.products);
        setReviews(res.reviews);
        setLives(res.lives);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Boutique introuvable.'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="h-72 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <Store className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">Boutique introuvable</h1>
        <p className="text-sm text-slate-600 mb-6">{error}</p>
        <button
          type="button"
          onClick={() => navigate('/boutiques')}
          className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Voir toutes les boutiques
        </button>
      </div>
    );
  }

  const isFollowing = Boolean(user?.followedShopIds.includes(shop.id));
  const shopUrl = `${window.location.origin}/boutique/${shop.slug}`;
  const waNum = shop.whatsappNumber ? normalizeWhatsappNumber(shop.whatsappNumber) : OFFICIAL_WHATSAPP_RAW;
  const waDisplay = shop.whatsappNumber ? shop.whatsappNumber : OFFICIAL_WHATSAPP_DISPLAY;

  const handleMessage = async () => {
    if (!user) {
      navigate('/connexion');
      return;
    }
    try {
      await sendDirectMessageDoc({
        sender: user,
        shop,
        text: `Bonjour ${shop.name}, je souhaite obtenir des renseignements sur vos articles.`,
      });
      navigate('/messagerie');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur messagerie.', 'error');
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
        targetType: 'shop',
        targetId: shop.id,
        targetLabel: shop.name,
        reason: reportReason,
      });
      setReportOpen(false);
      setReportReason('');
      showToast('Signalement enregistré.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  };

  return (
    <div>
      {/* Cover + Shop Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="h-52 sm:h-64 bg-[#0B1528] relative">
          <SafeImage src={shop.coverUrl} alt={shop.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#060D1A]/75 via-transparent to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 -mt-12 relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-white border-4 border-white shadow-lg shrink-0">
                <SafeImage src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
              </div>
              <div className="pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#0B1528] bg-white/95 px-2.5 py-0.5 rounded-md sm:bg-transparent sm:p-0">
                    {shop.name}
                  </h1>
                  {shop.verifiedStatus === 'verified' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{SHOP_STATUS_LABELS.verified}</span>
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-slate-600">
                      ({SHOP_STATUS_LABELS[shop.verifiedStatus]})
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-2">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {shop.city}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Users className="w-3.5 h-3.5" />
                    {products.length} article{products.length > 1 ? 's' : ''}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Eye className="w-3.5 h-3.5" />
                    {shop.visitorCount} visite{shop.visitorCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void toggleFollowShop(shop.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                  isFollowing
                    ? 'bg-orange-600 text-white border-orange-600'
                    : 'bg-white text-[#0B1528] border-slate-300 hover:border-[#0B1528]'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isFollowing ? 'fill-current' : ''}`} />
                <span>{isFollowing ? 'Boutique suivie' : 'Suivre'}</span>
              </button>

              <button
                type="button"
                onClick={handleMessage}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>

              <a
                href={`https://wa.me/${waNum}?text=${encodeURIComponent(
                  `Bonjour ${shop.name}, je visite votre boutique sur TECH STYLE MARKET (${shopUrl})`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp ({waDisplay})</span>
              </a>

              <button
                type="button"
                onClick={() => setReportOpen((v) => !v)}
                className="p-2.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 cursor-pointer"
                title="Signaler la boutique"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6 border-t border-slate-100">
            <div className="lg:col-span-8 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">{shop.description}</p>
              {shop.categories && shop.categories.length > 0 && (
                <p className="text-xs text-slate-600">
                  <span className="font-semibold text-[#0B1528]">Spécialités : </span>
                  {shop.categories.join(' · ')}
                </p>
              )}
              <SocialShareBar
                url={shopUrl}
                shareText={`Découvrez la boutique "${shop.name}" (${shop.city}) sur TECH STYLE MARKET :`}
                label="Partager la boutique"
              />
            </div>
            <div className="lg:col-span-4 text-xs text-slate-600 space-y-1">
              <p>
                <span className="font-semibold text-[#0B1528]">Adresse / Coordonnées : </span>
                {shop.contactInfo || shop.city}
              </p>
              <p>
                <span className="font-semibold text-[#0B1528]">Lien personnalisé : </span>
                <span className="font-mono text-orange-700">/boutique/{shop.slug}</span>
              </p>
            </div>
          </div>

          {reportOpen && (
            <form onSubmit={handleReport} className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 flex gap-3">
              <input
                required
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Motif du signalement de la boutique..."
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              />
              <button type="submit" className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg">
                Signaler
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Shop Lives */}
      {lives.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <h2 className="font-display font-bold text-xl text-[#0B1528] mb-4 flex items-center gap-2">
            <Video className="w-5 h-5 text-orange-600" />
            <span>Sessions Live Shopping de la boutique</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lives
              .filter((l) => l.status !== 'annule')
              .map((live) => (
                <button
                  key={live.id}
                  type="button"
                  onClick={() => navigate(`/live/${live.slug}`)}
                  className="text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-orange-500 flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div>
                    <p className="text-xs font-semibold text-orange-600 mb-1">
                      {live.status === 'en_direct'
                        ? 'EN DIRECT'
                        : live.status === 'programme' || live.status === 'en_preparation'
                          ? `${LIVE_STATUS_LABELS[live.status]} · ${new Date(live.scheduledAt).toLocaleString('fr-FR')}`
                          : LIVE_STATUS_LABELS[live.status]}
                    </p>
                    <p className="font-display font-semibold text-sm text-[#0B1528]">{live.title}</p>
                  </div>
                  <span className="text-xs font-semibold text-[#0B1528] shrink-0">Ouvrir →</span>
                </button>
              ))}
          </div>
        </section>
      )}

      {/* Shop Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="font-display font-bold text-xl text-[#0B1528] mb-6">
          Catalogue de {shop.name} ({products.length})
        </h2>
        {products.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            Cette boutique n’a pas encore publié d’articles disponibles.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={{ ...p, shop }} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <h2 className="font-display font-bold text-xl text-[#0B1528] mb-4">
            Avis sur la boutique ({reviews.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-[#0B1528]">{r.userName}</span>
                  <span className="font-mono text-orange-600">{r.rating}/5</span>
                </div>
                <p className="text-sm text-slate-600">{r.comment}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
