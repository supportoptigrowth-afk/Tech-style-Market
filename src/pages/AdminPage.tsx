import { ShieldAlert, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { LIVE_STATUS_LABELS, ORDER_STATUS_LABELS, SHOP_STATUS_LABELS, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import {
  adminCreateCategory,
  adminDeleteCategory,
  adminDeleteLive,
  adminDeleteLiveComment,
  adminDeleteProduct,
  adminToggleLiveModeration,
  adminToggleReviewHide,
  adminToggleUserSuspend,
  adminUpdateProductStatus,
  adminUpdateReportStatus,
  adminUpdateStoreStatus,
  fetchAdminOverviewData,
  fetchLiveCommentsList,
} from '../lib/firestoreService';
import type {
  CategoryItem,
  LiveComment,
  LiveSession,
  Product,
  ReportItem,
  Review,
  Shop,
  ShopStatus,
  SubOrder,
  User,
} from '../types';

interface AdminOverview {
  stats: {
    usersCount: number;
    vendorsCount: number;
    shopsCount: number;
    pendingShopsCount: number;
    productsCount: number;
    ordersCount: number;
    totalRevenue: number;
    openReportsCount: number;
  };
  users: User[];
  shops: Shop[];
  products: Product[];
  orders: SubOrder[];
  reviews: Review[];
  lives: LiveSession[];
  reports: ReportItem[];
  categories: CategoryItem[];
}

export function AdminPage() {
  const { user, navigate, showToast } = useApp();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<
    'boutiques' | 'utilisateurs' | 'produits' | 'commandes' | 'signalements' | 'moderation' | 'categories'
  >('boutiques');

  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [liveFilter, setLiveFilter] = useState<'tous' | 'en_direct' | 'programme' | 'termine'>('tous');
  const [moderatingLive, setModeratingLive] = useState<LiveSession | null>(null);
  const [liveComments, setLiveComments] = useState<LiveComment[]>([]);
  const [loadingLiveComments, setLoadingLiveComments] = useState(false);
  const [deleteLiveConfirm, setDeleteLiveConfirm] = useState<LiveSession | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAdminOverviewData();
      setData(res);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Accès refusé.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.roles.includes('admin')) {
      void loadOverview();
    } else {
      setLoading(false);
    }
  }, [user, loadOverview]);

  if (!user || !user.roles.includes('admin')) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">
          Accès réservé à l’administration
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Les droits administrateur sont vérifiés exclusivement côté serveur.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Retour à l’accueil
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="h-72 bg-slate-200 rounded-xl animate-pulse" />
        )}
      </div>
    );
  }

  const updateShopStatus = async (shopId: string, verifiedStatus: ShopStatus) => {
    await adminUpdateStoreStatus(shopId, verifiedStatus);
    showToast('Statut de boutique mis à jour.', 'success');
    await loadOverview();
  };

  const toggleUserSuspend = async (u: User) => {
    await adminToggleUserSuspend(u.id, !u.suspended);
    showToast(u.suspended ? 'Compte réactivé.' : 'Compte suspendu.', 'info');
    await loadOverview();
  };

  const updateProductStatus = async (productId: string, status: string) => {
    await adminUpdateProductStatus(productId, status);
    showToast('Statut produit mis à jour.', 'success');
    await loadOverview();
  };

  const deleteProduct = async (productId: string) => {
    await adminDeleteProduct(productId);
    showToast('Produit supprimé.', 'info');
    await loadOverview();
  };

  const updateReport = async (id: string, status: 'resolu' | 'rejete') => {
    await adminUpdateReportStatus(id, status);
    showToast('Signalement traité.', 'success');
    await loadOverview();
  };

  const toggleReviewHide = async (r: Review) => {
    await adminToggleReviewHide(r.id, !r.hidden);
    await loadOverview();
  };

  const toggleLiveModeration = async (l: LiveSession) => {
    await adminToggleLiveModeration(l.id, !l.moderatedHidden);
    showToast(l.moderatedHidden ? 'Live rétabli.' : 'Live suspendu.', 'info');
    await loadOverview();
  };

  const openLiveCommentsModerator = async (l: LiveSession) => {
    setModeratingLive(l);
    setLoadingLiveComments(true);
    try {
      const list = await fetchLiveCommentsList(l.id);
      setLiveComments(list);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur chargement commentaires.', 'error');
    } finally {
      setLoadingLiveComments(false);
    }
  };

  const handleDeleteLiveCommentAdmin = async (commentId: string) => {
    if (!moderatingLive) return;
    await adminDeleteLiveComment(moderatingLive.id, commentId);
    setLiveComments((prev) => prev.filter((c) => c.id !== commentId));
    showToast('Commentaire supprimé.', 'info');
  };

  const confirmAdminDeleteLive = async () => {
    if (!deleteLiveConfirm) return;
    await adminDeleteLive(deleteLiveConfirm.id);
    if (moderatingLive?.id === deleteLiveConfirm.id) {
      setModeratingLive(null);
      setLiveComments([]);
    }
    setDeleteLiveConfirm(null);
    showToast('Session Live supprimée.', 'info');
    await loadOverview();
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminCreateCategory(newCatName, newCatDesc);
      setNewCatName('');
      setNewCatDesc('');
      showToast('Catégorie ajoutée.', 'success');
      await loadOverview();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    await adminDeleteCategory(id);
    showToast('Catégorie supprimée.', 'info');
    await loadOverview();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold text-orange-600 mb-1">Administration TECH STYLE MARKET</p>
        <h1 className="font-display font-bold text-3xl text-[#0B1528]">
          Console de supervision et modération
        </h1>
      </div>

      {/* Platform KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Utilisateurs / Vendeurs</p>
          <p className="font-mono font-bold text-2xl text-[#0B1528] tabular-nums mt-1">
            {data.stats.usersCount} / {data.stats.vendorsCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Boutiques (à valider)</p>
          <p className="font-mono font-bold text-2xl text-[#0B1528] tabular-nums mt-1">
            {data.stats.shopsCount} ({data.stats.pendingShopsCount})
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Volume des commandes</p>
          <p className="font-mono font-bold text-2xl text-orange-600 tabular-nums mt-1">
            {formatFCFA(data.stats.totalRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Signalements ouverts</p>
          <p className="font-mono font-bold text-2xl text-[#0B1528] tabular-nums mt-1">
            {data.stats.openReportsCount}
          </p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-200/70 rounded-lg mb-8 w-fit">
        {(
          [
            { id: 'boutiques', label: `Boutiques (${data.shops.length})` },
            { id: 'utilisateurs', label: `Utilisateurs (${data.users.length})` },
            { id: 'produits', label: `Produits (${data.products.length})` },
            { id: 'commandes', label: `Commandes (${data.orders.length})` },
            { id: 'signalements', label: `Signalements (${data.reports.length})` },
            { id: 'moderation', label: 'Avis & Lives' },
            { id: 'categories', label: 'Catégories' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold whitespace-nowrap cursor-pointer ${
              tab === t.id ? 'bg-white text-[#0B1528] shadow-sm' : 'text-slate-600 hover:text-[#0B1528]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'boutiques' && (
        <div className="space-y-3">
          {data.shops.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <p className="font-display font-bold text-base text-[#0B1528]">
                  {s.name}{' '}
                  <span className="text-xs font-mono font-normal text-slate-500">(/boutique/{s.slug})</span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {s.city} · Statut :{' '}
                  <span className="font-semibold text-orange-600">
                    {SHOP_STATUS_LABELS[s.verifiedStatus]}
                  </span>
                  {s.certificationRequested && ' · Certification demandée'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateShopStatus(s.id, 'verified')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Valider / Certifier
                </button>
                <button
                  type="button"
                  onClick={() => updateShopStatus(s.id, 'pending')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                >
                  En attente
                </button>
                <button
                  type="button"
                  onClick={() => updateShopStatus(s.id, 'suspended')}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Suspendre
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'utilisateurs' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="p-4 font-semibold">Nom</th>
                <th className="p-4 font-semibold">Email</th>
                <th className="p-4 font-semibold">Ville</th>
                <th className="p-4 font-semibold">Rôles</th>
                <th className="p-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="p-4 font-medium">{u.fullName}</td>
                  <td className="p-4 text-xs text-slate-600">{u.email}</td>
                  <td className="p-4 text-xs">{u.city}</td>
                  <td className="p-4 text-xs font-mono">{u.roles.join(', ')}</td>
                  <td className="p-4 text-right">
                    {u.id !== user.id && (
                      <button
                        type="button"
                        onClick={() => toggleUserSuspend(u)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          u.suspended
                            ? 'bg-emerald-700 text-white'
                            : 'border border-red-200 text-red-700 hover:bg-red-50'
                        }`}
                      >
                        {u.suspended ? 'Réactiver' : 'Suspendre'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'produits' && (
        <div className="space-y-3">
          {data.products.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <p className="font-mono text-xs text-slate-500">
                  {p.reference} · {p.category} · Statut : {p.status}
                </p>
                <p className="font-display font-semibold text-sm text-[#0B1528]">{p.name}</p>
                <p className="font-mono text-xs text-orange-600 tabular-nums">
                  {formatFCFA(p.promoPrice ?? p.price)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => updateProductStatus(p.id, p.status === 'masque' ? 'disponible' : 'masque')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                >
                  {p.status === 'masque' ? 'Rétablir' : 'Masquer'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteProduct(p.id)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold cursor-pointer"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'commandes' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="p-4 font-semibold">Réf</th>
                <th className="p-4 font-semibold">Client</th>
                <th className="p-4 font-semibold">Boutique</th>
                <th className="p-4 font-semibold text-right">Montant</th>
                <th className="p-4 font-semibold text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Aucune commande enregistrée.
                  </td>
                </tr>
              ) : (
                data.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="p-4 font-mono text-xs">{o.orderNumber}</td>
                    <td className="p-4">{o.customerName}</td>
                    <td className="p-4 text-slate-600">{o.shopName}</td>
                    <td className="p-4 text-right font-mono tabular-nums">{formatFCFA(o.subtotal)}</td>
                    <td className="p-4 text-right text-xs font-semibold text-orange-600">
                      {ORDER_STATUS_LABELS[o.status]}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'signalements' && (
        <div className="space-y-3">
          {data.reports.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Aucun signalement à traiter.
            </div>
          ) : (
            data.reports.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="text-xs text-slate-500">
                    {r.targetType} · {r.targetLabel} · Par {r.reporterName} · Statut : {r.status}
                  </p>
                  <p className="text-sm text-[#0B1528] mt-1">{r.reason}</p>
                </div>
                {r.status === 'ouvert' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateReport(r.id, 'resolu')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Marquer résolu
                    </button>
                    <button
                      type="button"
                      onClick={() => updateReport(r.id, 'rejete')}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'moderation' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="font-display font-bold text-base text-[#0B1528]">Modération des avis</h2>
            {data.reviews.length === 0 ? (
              <p className="text-xs text-slate-500">Aucun avis.</p>
            ) : (
              data.reviews.map((r) => (
                <div key={r.id} className="p-3 rounded-lg border border-slate-100 flex justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">{r.userName} ({r.rating}/5)</p>
                    <p className="text-xs text-slate-600">{r.comment}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleReviewHide(r)}
                    className="px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    {r.hidden ? 'Afficher' : 'Masquer'}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display font-bold text-base text-[#0B1528]">
                Modération des Lives ({data.lives.length})
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'tous', label: 'Tous' },
                    { id: 'en_direct', label: 'En direct' },
                    { id: 'programme', label: 'Programmés' },
                    { id: 'termine', label: 'Terminés' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLiveFilter(f.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                      liveFilter === f.id
                        ? 'bg-[#0B1528] text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {data.lives
              .filter((l) => {
                if (liveFilter === 'tous') return true;
                if (liveFilter === 'programme') {
                  return l.status === 'programme' || l.status === 'en_preparation';
                }
                return l.status === liveFilter;
              })
              .map((l) => (
                <div
                  key={l.id}
                  className="p-3.5 rounded-lg border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#0B1528] truncate">{l.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {l.shopName} ·{' '}
                        <span className="font-semibold text-orange-600">
                          {LIVE_STATUS_LABELS[l.status]}
                        </span>{' '}
                        · {l.youtubeVideoId ? `YouTube (${l.youtubeVideoId})` : 'Sans lien YouTube'}
                      </p>
                      {l.moderatedHidden && (
                        <p className="text-[11px] font-semibold text-red-600 mt-0.5">
                          Suspendu / Masqué du public
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/live/${l.slug}`)}
                      className="px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Ouvrir
                    </button>
                    <button
                      type="button"
                      onClick={() => void openLiveCommentsModerator(l)}
                      className="px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      Commentaires
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleLiveModeration(l)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                        l.moderatedHidden
                          ? 'bg-emerald-700 text-white'
                          : 'border border-amber-300 text-amber-800 bg-amber-50'
                      }`}
                    >
                      {l.moderatedHidden ? 'Rétablir' : 'Suspendre'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteLiveConfirm(l)}
                      className="px-2.5 py-1 rounded border border-red-200 text-red-600 text-xs font-semibold cursor-pointer"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}

            {moderatingLive && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#0B1528]">
                    Chat du live : {moderatingLive.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModeratingLive(null);
                      setLiveComments([]);
                    }}
                    className="text-xs text-slate-500 hover:text-[#0B1528] cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
                {loadingLiveComments ? (
                  <p className="text-xs text-slate-500">Chargement des commentaires...</p>
                ) : liveComments.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucun commentaire sur cette session.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {liveComments.map((c) => (
                      <div
                        key={c.id}
                        className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-start justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-[#0B1528]">
                            {c.userName}{' '}
                            <span className="font-normal text-slate-400">
                              · {new Date(c.createdAt).toLocaleTimeString('fr-FR')}
                            </span>
                          </p>
                          <p className="text-slate-700 mt-0.5">{c.text}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteLiveCommentAdmin(c.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer shrink-0"
                          aria-label="Supprimer le commentaire"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleAddCategory}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <h2 className="font-display font-bold text-base text-[#0B1528]">Ajouter une catégorie</h2>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nom de la catégorie"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <textarea
              rows={2}
              value={newCatDesc}
              onChange={(e) => setNewCatDesc(e.target.value)}
              placeholder="Description..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer"
            >
              Ajouter
            </button>
          </form>

          <div className="lg:col-span-8 space-y-2">
            {data.categories.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <p className="font-display font-semibold text-sm text-[#0B1528]">{c.name}</p>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id)}
                  className="p-2 text-slate-400 hover:text-red-600 cursor-pointer"
                  aria-label="Supprimer la catégorie"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {deleteLiveConfirm && (
        <div
          className="fixed inset-0 z-50 bg-[#060D1A]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display font-bold text-lg text-[#0B1528]">
              Supprimer ce Live Shopping
            </h3>
            <p className="text-sm text-slate-600">
              Confirmez-vous la suppression définitive de la session{' '}
              <span className="font-semibold text-[#0B1528]">« {deleteLiveConfirm.title} »</span> ?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteLiveConfirm(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmAdminDeleteLive()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
