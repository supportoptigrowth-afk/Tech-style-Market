import {
  AlertTriangle,
  ExternalLink,
  Flag,
  HelpCircle,
  MessageCircle,
  Radio,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Video,
  Youtube,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { LIVE_STATUS_LABELS, buildWhatsappOrderUrl, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import {
  createReportDoc,
  fetchLiveRoomData,
  fetchPublicLives,
  subscribeLiveComments,
} from '../lib/firestoreService';
import {
  deleteLiveCommentViaApi,
  parseStrictYouTubeUrl,
  postLiveCommentViaApi,
} from '../lib/youtube';
import type { LiveComment, LiveSession, LiveStatus, Product, Shop } from '../types';
import { SafeImage } from '../components/SafeImage';
import { SocialShareBar } from '../components/SocialShareBar';

function getLiveBadgeStyle(status: LiveStatus): string {
  switch (status) {
    case 'en_direct':
      return 'bg-orange-600 text-white';
    case 'en_preparation':
      return 'bg-amber-500 text-white';
    case 'programme':
      return 'bg-[#0B1528]/90 text-slate-100';
    case 'annule':
      return 'bg-red-600 text-white';
    case 'termine':
    default:
      return 'bg-slate-700 text-slate-100';
  }
}

export function LiveDirectoryPage() {
  const { navigate, user } = useApp();
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'tous' | 'en_direct' | 'a_venir' | 'termine'>('tous');

  useEffect(() => {
    fetchPublicLives()
      .then((res) => setLives(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const filteredLives = useMemo(() => {
    const visible = lives.filter((l) => l.status !== 'annule');
    if (filter === 'en_direct') return visible.filter((l) => l.status === 'en_direct');
    if (filter === 'a_venir') {
      return visible.filter((l) => l.status === 'programme' || l.status === 'en_preparation');
    }
    if (filter === 'termine') return visible.filter((l) => l.status === 'termine');
    return visible;
  }, [lives, filter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">
            TECH STYLE MARKET · YouTube Live
          </p>
          <h1 className="font-display font-bold text-3xl text-[#0B1528]">Live Shopping</h1>
          <p className="text-sm text-slate-600 mt-1">
            Assistez aux démonstrations en direct des vendeurs, posez vos questions dans le chat
            et commandez les articles présentés sur le site ou via WhatsApp.
          </p>
        </div>
        {user?.roles.includes('vendor') && (
          <button
            type="button"
            onClick={() => navigate('/espace-vendeur')}
            className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer shrink-0"
          >
            Programmer un live
          </button>
        )}
      </div>

      {/* Filtres de statut */}
      <div className="flex flex-wrap gap-2 mb-8">
        {(
          [
            { id: 'tous', label: 'Tous les lives' },
            { id: 'en_direct', label: 'En direct' },
            { id: 'a_venir', label: 'Programmés & en préparation' },
            { id: 'termine', label: 'Terminés' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === item.id
                ? 'bg-[#0B1528] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-[#0B1528]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="h-72 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredLives.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
          Aucune session Live Shopping correspondante pour le moment.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredLives.map((live) => (
            <div
              key={live.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-orange-400 transition-colors"
            >
              <div className="aspect-[16/9] bg-[#0B1528] relative">
                <SafeImage
                  src={live.coverUrl}
                  alt={live.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060D1A]/90 via-[#060D1A]/20 to-transparent p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md ${getLiveBadgeStyle(
                        live.status,
                      )}`}
                    >
                      {live.status === 'en_direct' && (
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      )}
                      <span>{LIVE_STATUS_LABELS[live.status]}</span>
                    </span>
                    <span className="bg-[#0B1528]/85 text-slate-200 px-2.5 py-1 rounded-md">
                      {live.category || 'Catalogue'}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs text-orange-400 font-semibold">{live.shopName}</p>
                    <h2 className="font-display font-bold text-lg text-white line-clamp-1 mt-0.5">
                      {live.title}
                    </h2>
                  </div>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <p className="text-sm text-slate-600 line-clamp-2">
                  {live.description || 'Présentation en direct des articles de la boutique.'}
                </p>
                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500">
                    <p>{new Date(live.scheduledAt).toLocaleString('fr-FR')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {live.productIds.length} produit{live.productIds.length > 1 ? 's' : ''} associé
                      {live.productIds.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/live/${live.slug}`)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Ouvrir la salle</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveRoomPage({ slug }: { slug: string }) {
  const { user, addToCart, navigate, showToast } = useApp();
  const [live, setLive] = useState<LiveSession | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Signalement live ou commentaire
  const [reportTarget, setReportTarget] = useState<{
    type: 'live' | 'live_comment';
    id: string;
    label: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchLiveRoomData(slug)
      .then((res) => {
        setLive(res.live);
        setShop(res.shop);
        setProducts(res.products);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Session Live introuvable.'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!live?.id) return;
    return subscribeLiveComments(live.id, setComments);
  }, [live?.id]);

  const isHost = Boolean(user && live && user.id === live.vendorId);
  const isAdmin = Boolean(user?.roles.includes('admin'));

  const submitChatMessage = async (
    rawText: string,
    reactionType: 'comment' | 'question' | 'reaction' = 'comment',
  ) => {
    if (!user) {
      navigate('/connexion');
      return;
    }
    if (!live || !rawText.trim() || sendingComment) return;
    setChatNotice('');
    setSendingComment(true);
    try {
      await postLiveCommentViaApi({
        liveId: live.id,
        text: rawText.trim(),
        userName: user.fullName,
        userAvatar: user.avatarUrl,
        reactionType,
      });
      if (reactionType !== 'reaction') {
        setCommentText('');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur d’envoi du message.';
      setChatNotice(msg);
      showToast(msg, 'error');
    } finally {
      setSendingComment(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const isQ = commentText.includes('?');
    await submitChatMessage(commentText, isQ ? 'question' : 'comment');
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!live) return;
    try {
      await deleteLiveCommentViaApi(live.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      showToast('Message supprimé.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Suppression impossible.', 'error');
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/connexion');
      return;
    }
    if (!reportTarget || reportReason.trim().length < 5) {
      showToast('Décrivez la raison du signalement (min. 5 caractères).', 'error');
      return;
    }
    setSubmittingReport(true);
    try {
      await createReportDoc({
        reporter: user,
        targetType: reportTarget.type,
        targetId: reportTarget.id,
        targetLabel: reportTarget.label,
        reason: reportReason.trim(),
      });
      showToast('Signalement envoyé à la modération.', 'success');
      setReportTarget(null);
      setReportReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur signalement.', 'error');
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !live) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">{error || 'Session introuvable.'}</p>
        <button
          type="button"
          onClick={() => navigate('/live')}
          className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Retour au Live Shopping
        </button>
      </div>
    );
  }

  const liveUrl = `${window.location.origin}/live/${live.slug}`;
  const strictYouTube = parseStrictYouTubeUrl(live.youtubeUrl || live.embedUrl || live.streamUrl);
  const safeEmbedUrl = strictYouTube?.embedUrl || (live.embedUrl?.startsWith('https://www.youtube.com/embed/') ? live.embedUrl : null);
  const canShowVideo = Boolean(safeEmbedUrl && live.status === 'en_direct' && !live.moderatedHidden);

  const renderStatusOverlayCopy = () => {
    if (live.moderatedHidden) {
      return {
        title: 'Diffusion suspendue par la modération',
        subtitle: 'Cette session est actuellement masquée pour vérification.',
      };
    }
    if (live.status === 'annule') {
      return {
        title: 'Cette session Live a été annulée',
        subtitle: 'Consultez la boutique du vendeur pour découvrir ses produits disponibles.',
      };
    }
    if (live.status === 'termine') {
      return {
        title: 'Cette session Live Shopping est terminée',
        subtitle:
          'Vous pouvez toujours consulter les articles présentés, ajouter au panier ou commander sur WhatsApp.',
      };
    }
    if (live.status === 'en_preparation') {
      return {
        title: 'Le vendeur prépare la diffusion YouTube Live',
        subtitle: `Début prévu : ${new Date(live.scheduledAt).toLocaleString('fr-FR')}. Le lecteur vidéo apparaîtra dès que le vendeur confirmera « En direct ».`,
      };
    }
    if (live.status === 'en_direct' && !safeEmbedUrl) {
      return {
        title: 'Lien YouTube Live non encore associé',
        subtitle: isHost
          ? 'Ajoutez votre lien YouTube Live depuis l’onglet « Mes Lives » de votre Espace vendeur.'
          : 'Le vendeur est en train de finaliser la connexion vidéo.',
      };
    }
    return {
      title: `Diffusion programmée le ${new Date(live.scheduledAt).toLocaleString('fr-FR')}`,
      subtitle:
        'Patientez dans la salle : posez déjà vos questions dans le chat ou parcourez les articles présentés.',
    };
  };

  const overlayCopy = renderStatusOverlayCopy();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* En-tête de la salle */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
            <SafeImage
              src={shop?.logoUrl || live.coverUrl}
              alt={live.shopName}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold mb-1.5">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md ${getLiveBadgeStyle(
                  live.status,
                )}`}
              >
                {live.status === 'en_direct' && <Radio className="w-3.5 h-3.5 animate-pulse" />}
                <span>{LIVE_STATUS_LABELS[live.status]}</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {live.category || 'Live Shopping'}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-normal">
                {new Date(live.scheduledAt).toLocaleString('fr-FR')}
              </span>
            </div>
            <h1 className="font-display font-bold text-2xl text-[#0B1528]">{live.title}</h1>
            {live.description && (
              <p className="text-xs text-slate-600 mt-1 max-w-3xl">{live.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/boutique/${live.shopSlug}`)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Accéder à la boutique</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setReportTarget({
                type: 'live',
                id: live.id,
                label: `Live : ${live.title}`,
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 text-xs font-semibold cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>Signaler</span>
          </button>
        </div>
      </div>

      {/* Partage du live */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          <span className="font-semibold text-[#0B1528]">Boutique : </span>
          <span>{live.shopName}</span>
          {isHost && (
            <button
              type="button"
              onClick={() => navigate('/espace-vendeur')}
              className="ml-3 text-orange-600 font-semibold hover:underline cursor-pointer"
            >
              Gérer ce live dans mon Espace vendeur →
            </button>
          )}
        </div>
        <SocialShareBar
          url={liveUrl}
          shareText={`Regardez le Live Shopping « ${live.title} » de ${live.shopName} sur TECH STYLE MARKET :`}
          label="Partager le live"
          compact
        />
      </div>

      {/* Grille principale : Lecteur YouTube Live + Produits à gauche / Chat en direct à droite */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          {/* Lecteur YouTube Live (strictement validé) */}
          <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[#060D1A] border border-slate-800 relative">
            {canShowVideo && safeEmbedUrl ? (
              <iframe
                src={safeEmbedUrl}
                title={live.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
              />
            ) : (
              <div className="relative w-full h-full">
                <SafeImage
                  src={live.coverUrl}
                  alt={live.title}
                  className="w-full h-full object-cover opacity-35"
                />
                <div className="absolute inset-0 bg-[#060D1A]/65 flex flex-col items-center justify-center text-center p-6 text-white">
                  <div className="w-12 h-12 rounded-full bg-orange-600/20 border border-orange-500/40 flex items-center justify-center mb-3">
                    <Youtube className="w-6 h-6 text-orange-500" />
                  </div>
                  <p className="font-display font-bold text-lg max-w-lg">{overlayCopy.title}</p>
                  <p className="text-xs text-slate-300 max-w-md mt-1.5 leading-relaxed">
                    {overlayCopy.subtitle}
                  </p>
                  {live.status === 'termine' && strictYouTube && (
                    <a
                      href={strictYouTube.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/20"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Voir la rediffusion sur YouTube</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {canShowVideo && strictYouTube && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
              <span>Diffusion assurée via YouTube Live</span>
              <a
                href={strictYouTube.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#0B1528] hover:text-orange-600"
              >
                <span>Ouvrir sur YouTube</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Produits présentés pendant le live */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-display font-bold text-base text-[#0B1528]">
                Produits présentés pendant le live ({products.length})
              </h2>
            </div>

            {products.length === 0 ? (
              <p className="text-xs text-slate-500">
                Aucun produit associé à cette session pour le moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.map((p) => {
                  const isFeatured = live.featuredProductId === p.id;
                  const price = p.promoPrice && p.promoPrice < p.price ? p.promoPrice : p.price;
                  const isOutOfStock = p.status === 'rupture' || p.stock <= 0;
                  const wa = buildWhatsappOrderUrl({
                    whatsappNumber: shop?.whatsappNumber,
                    productName: p.name,
                    price,
                    reference: p.reference,
                    productUrl: `${window.location.origin}/produit/${p.id}`,
                  });

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex gap-3 items-start ${
                        isFeatured
                          ? 'border-orange-500 bg-orange-50/40 ring-1 ring-orange-200'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(`/produit/${p.id}`)}
                        className="w-20 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0 cursor-pointer"
                      >
                        <SafeImage
                          src={p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        {isFeatured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-600 text-white text-[10px] font-semibold mb-1">
                            <Sparkles className="w-3 h-3" />
                            <span>Produit mis en avant</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => navigate(`/produit/${p.id}`)}
                          className="block text-left font-semibold text-xs text-[#0B1528] line-clamp-2 hover:text-orange-600 cursor-pointer"
                        >
                          {p.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono font-bold text-sm text-orange-600 tabular-nums">
                            {formatFCFA(price)}
                          </span>
                          {p.promoPrice && p.promoPrice < p.price && (
                            <span className="font-mono text-[11px] text-slate-400 line-through tabular-nums">
                              {formatFCFA(p.price)}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-[11px] font-medium mt-0.5 ${
                            isOutOfStock ? 'text-red-600' : 'text-emerald-700'
                          }`}
                        >
                          {isOutOfStock ? 'Rupture de stock' : `Disponible (${p.stock} en stock)`}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          <button
                            type="button"
                            disabled={isOutOfStock}
                            onClick={() => addToCart(p.id, 1)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-[11px] font-semibold cursor-pointer disabled:opacity-45"
                          >
                            <ShoppingBag className="w-3 h-3" />
                            <span>Ajouter au panier</span>
                          </button>
                          <a
                            href={wa.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-semibold"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat en direct & modération */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl flex flex-col h-[580px]">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display font-bold text-sm text-[#0B1528]">
                Chat &amp; questions en direct
              </h2>
              <p className="text-[11px] text-slate-500">
                {comments.length} message{comments.length > 1 ? 's' : ''} · Modération active
              </p>
            </div>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
              Temps réel
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {comments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">
                Soyez le premier à commenter ou poser une question au vendeur.
              </p>
            ) : (
              comments.map((c) => {
                const canDelete = Boolean(user && (isHost || isAdmin || user.id === c.userId));
                const timeStr = c.createdAt
                  ? new Date(c.createdAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';
                const initials = (c.userName || 'U').slice(0, 2).toUpperCase();

                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl text-xs border ${
                      c.isQuestion
                        ? 'bg-orange-50/80 border-orange-200'
                        : c.reactionType === 'reaction'
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-[#0B1528] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {c.userAvatar ? (
                          <SafeImage
                            src={c.userAvatar}
                            alt={c.userName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{initials}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-[#0B1528] truncate">
                              {c.userName}
                            </span>
                            {c.userId === live.vendorId && (
                              <span className="px-1.5 py-0.5 rounded bg-[#0B1528] text-white text-[9px] font-semibold">
                                Vendeur
                              </span>
                            )}
                            {c.isQuestion && (
                              <span className="inline-flex items-center gap-0.5 text-orange-700 font-semibold text-[10px]">
                                <HelpCircle className="w-3 h-3" />
                                <span>Question</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            {timeStr}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 break-words leading-relaxed">{c.text}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteComment(c.id)}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Supprimer ce commentaire"
                            aria-label="Supprimer ce commentaire"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {user && user.id !== c.userId && (
                          <button
                            type="button"
                            onClick={() =>
                              setReportTarget({
                                type: 'live_comment',
                                id: `${live.id}:${c.id}`,
                                label: `Commentaire de ${c.userName} : ${c.text.slice(0, 60)}`,
                              })
                            }
                            className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                            title="Signaler ce message"
                            aria-label="Signaler ce message"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Réactions rapides */}
          {live.status !== 'annule' && !live.moderatedHidden && (
            <div className="px-3 pt-2 pb-1 border-t border-slate-100 flex flex-wrap gap-1.5">
              {[
                { label: '🔥 Super article !', type: 'reaction' as const },
                { label: '👏 Bravo', type: 'reaction' as const },
                { label: '❤️ J’aime', type: 'reaction' as const },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  disabled={sendingComment}
                  onClick={() => void submitChatMessage(btn.label, btn.type)}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-[#0B1528] cursor-pointer disabled:opacity-50"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {chatNotice && (
            <div className="mx-3 mt-1 px-2.5 py-1.5 rounded bg-red-50 border border-red-200 text-[11px] text-red-700">
              {chatNotice}
            </div>
          )}

          <form onSubmit={handleSendComment} className="p-3 border-t border-slate-200 flex gap-2">
            <input
              type="text"
              maxLength={500}
              disabled={sendingComment || live.status === 'annule' || Boolean(live.moderatedHidden)}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={
                !user
                  ? 'Connectez-vous pour participer au chat'
                  : live.status === 'annule'
                    ? 'Chat fermé pour ce live'
                    : 'Commenter ou poser une question (?)...'
              }
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
            />
            <button
              type="submit"
              disabled={
                sendingComment ||
                (!user ? false : !commentText.trim()) ||
                live.status === 'annule' ||
                Boolean(live.moderatedHidden)
              }
              className="px-3.5 py-2 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Modale de signalement (Live ou Commentaire) */}
      {reportTarget && (
        <div
          className="fixed inset-0 z-50 bg-[#060D1A]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmitReport}
            className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="font-display font-bold text-lg text-[#0B1528]">
              Signaler un contenu
            </h3>
            <p className="text-xs text-slate-600">{reportTarget.label}</p>
            <textarea
              rows={3}
              required
              minLength={5}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Expliquez pourquoi vous signalez ce live ou ce commentaire..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setReportTarget(null);
                  setReportReason('');
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submittingReport}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                {submittingReport ? 'Envoi...' : 'Envoyer le signalement'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
