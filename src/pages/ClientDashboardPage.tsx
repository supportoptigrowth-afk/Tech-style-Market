import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import {
  Bell,
  Calendar,
  CheckCheck,
  Heart,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Minus,
  Package,
  Plus,
  Send,
  ShoppingBag,
  ShoppingCart,
  Store,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { NIGER_CITIES, ORDER_STATUS_LABELS, SHOP_STATUS_LABELS, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import {
  activateVendorRoleDoc,
  fetchCustomerOrders,
  fetchPublicCatalog,
  fetchPublicStores,
  sendDirectMessageDoc,
  subscribeConversations,
  subscribeUserMessages,
  updateUserProfileDoc,
} from '../lib/firestoreService';
import { uploadSimpleMediaImage } from '../lib/mediaService';
import type {
  DirectMessage,
  MessageThread,
  ProductWithShop,
  Shop,
  SubOrder,
} from '../types';
import { ProductCard } from '../components/ProductCard';
import { SafeImage } from '../components/SafeImage';

type ClientTab =
  | 'apercu'
  | 'commandes'
  | 'achats'
  | 'panier'
  | 'favoris'
  | 'boutiques'
  | 'notifications'
  | 'messages'
  | 'profil';

export function ClientDashboardPage({ initialTab = 'apercu' }: { initialTab?: 'apercu' | 'profil' }) {
  const {
    user,
    vendorShop,
    navigate,
    refreshAuth,
    logout,
    showToast,
    cart,
    cartCount,
    updateCartQty,
    removeFromCart,
    toggleFollowShop,
    notifications,
    unreadNotifications,
    markAllNotificationsRead,
  } = useApp();
  const { currentUser } = useAuth();

  const [tab, setTab] = useState<ClientTab>(initialTab === 'profil' ? 'profil' : 'apercu');
  const [orders, setOrders] = useState<SubOrder[]>([]);
  const [catalog, setCatalog] = useState<ProductWithShop[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [replyText, setReplyText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Profile edit state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [city, setCity] = useState(user?.city || 'Niamey');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [saving, setSaving] = useState(false);

  // Password management state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    setTab(initialTab === 'profil' ? 'profil' : 'apercu');
  }, [initialTab]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName);
    setPhone(user.phone);
    setCity(user.city);
    setAvatarUrl(user.avatarUrl);
    fetchCustomerOrders(user.id).then(setOrders).catch(() => {});
    fetchPublicCatalog().then(setCatalog).catch(() => {});
    fetchPublicStores().then(setShops).catch(() => {});

    const unsubThreads = subscribeConversations(user.id, (list) => {
      setThreads(list);
      setActiveThreadId((prev) => (prev && list.some((t) => t.id === prev) ? prev : list[0]?.id || ''));
    });
    const unsubMsgs = subscribeUserMessages(user.id, setMessages);

    return () => {
      unsubThreads();
      unsubMsgs();
    };
  }, [user]);

  const favoriteProducts = useMemo(() => {
    if (!user) return [];
    const set = new Set(user.favorites);
    return catalog.filter((p) => set.has(p.id));
  }, [catalog, user]);

  const followedShops = useMemo(() => {
    if (!user) return [];
    const set = new Set(user.followedShopIds);
    return shops.filter((s) => set.has(s.id));
  }, [shops, user]);

  const deliveredPurchases = useMemo(
    () => orders.filter((o) => o.status === 'livree'),
    [orders],
  );

  const cartLines = useMemo(() => {
    const map = new Map(catalog.map((p) => [p.id, p]));
    return cart
      .map((item) => {
        const product = map.get(item.productId);
        if (!product) return null;
        const unitPrice =
          product.promoPrice && product.promoPrice < product.price
            ? product.promoPrice
            : product.price;
        return {
          ...item,
          product,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, catalog]);

  const cartTotal = useMemo(
    () => cartLines.reduce((acc, l) => acc + l.lineTotal, 0),
    [cartLines],
  );

  const threadMessages = useMemo(
    () => messages.filter((m) => m.threadId === activeThreadId),
    [messages, activeThreadId],
  );

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">Espace personnel</h1>
        <p className="text-sm text-slate-600 mb-6">
          Connectez-vous pour accéder à vos commandes, achats, favoris et boutiques suivies.
        </p>
        <button
          type="button"
          onClick={() => navigate('/connexion')}
          className="px-6 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Se connecter
        </button>
      </div>
    );
  }

  const handleActivateVendor = async () => {
    try {
      await activateVendorRoleDoc(user.id);
      await refreshAuth();
      showToast('Rôle vendeur activé sur votre compte !', 'success');
      navigate(vendorShop ? '/espace-vendeur' : '/creer-boutique');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfileDoc(user.id, {
        fullName,
        phone,
        city,
        photoURL: avatarUrl,
      });
      await refreshAuth();
      showToast('Profil mis à jour.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadSimpleMediaImage(file, 'profile');
      setAvatarUrl(uploaded.url);
      showToast('Photo importée sur Cloudinary. Cliquez sur Enregistrer.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur upload.', 'error');
    }
  };

  const hasPasswordProvider = Boolean(
    currentUser?.providerData.some((p) => p.providerId === 'password'),
  );

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.email) return;
    if (newPassword.length < 6) {
      showToast('Le nouveau mot de passe doit contenir au moins 6 caractères.', 'error');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showToast('La confirmation ne correspond pas au nouveau mot de passe.', 'error');
      return;
    }
    setUpdatingPassword(true);
    try {
      const cred = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, cred);
      await updatePassword(currentUser, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast('Mot de passe modifié avec succès.', 'success');
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        showToast('Mot de passe actuel incorrect.', 'error');
      } else if (code === 'auth/requires-recent-login') {
        showToast('Veuillez vous reconnecter puis réessayer.', 'error');
      } else {
        showToast(err instanceof Error ? err.message : 'Impossible de modifier le mot de passe.', 'error');
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user.email) return;
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      showToast(`Email de réinitialisation envoyé à ${user.email}.`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Erreur lors de l’envoi de l’email.',
        'error',
      );
    } finally {
      setSendingReset(false);
    }
  };

  const handleSendThreadMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !replyText.trim()) return;
    setSendingMsg(true);
    try {
      await sendDirectMessageDoc({
        sender: user,
        threadId: activeThreadId,
        text: replyText,
      });
      setReplyText('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi message.', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  const activeOrders = orders.filter((o) => o.status !== 'livree' && o.status !== 'annulee');
  const registrationDate = new Date(user.createdAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const navItems: Array<{ id: ClientTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'apercu', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { id: 'commandes', label: 'Mes commandes', icon: Package, badge: orders.length },
    { id: 'achats', label: 'Mes achats', icon: CheckCheck, badge: deliveredPurchases.length },
    { id: 'panier', label: 'Mon panier', icon: ShoppingCart, badge: cartCount },
    { id: 'favoris', label: 'Mes favoris', icon: Heart, badge: favoriteProducts.length },
    { id: 'boutiques', label: 'Boutiques suivies', icon: Store, badge: followedShops.length },
    { id: 'notifications', label: 'Mes notifications', icon: Bell, badge: unreadNotifications },
    { id: 'messages', label: 'Mes messages', icon: MessageSquare, badge: threads.length },
    { id: 'profil', label: 'Mon profil', icon: UserIcon },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Top User Strip */}
      <div className="bg-[#0B1528] text-white rounded-xl p-6 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#132342] border border-[#1D345E] flex items-center justify-center shrink-0">
            {user.avatarUrl ? (
              <SafeImage src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-7 h-7 text-orange-400" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl sm:text-2xl truncate">{user.fullName}</h1>
            <p className="text-xs text-slate-300 mt-1 break-all">
              {user.email} · {user.phone || 'Téléphone non renseigné'} · {user.city}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-2">
              <span className="font-mono">ID : {user.id}</span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Inscrit le {registrationDate}</span>
              </span>
              <span>Rôles : {user.roles.join(' / ')}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {user.roles.includes('vendor') ? (
            <button
              type="button"
              onClick={() => navigate(vendorShop ? '/espace-vendeur' : '/creer-boutique')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>{vendorShop ? 'Ouvrir mon espace vendeur' : 'Créer ma boutique'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleActivateVendor}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer"
            >
              <Store className="w-4 h-4" />
              <span>Devenir vendeur</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-600 text-slate-200 hover:text-white text-xs font-semibold cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* Main Sidebar + Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-2.5 lg:sticky lg:top-24">
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1" aria-label="Menu espace client">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0B1528] text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-400' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded tabular-nums ${
                        active ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Panel */}
        <div className="lg:col-span-9 space-y-6">
          {/* 1. VUE D'ENSEMBLE */}
          {tab === 'apercu' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Commandes en cours</p>
                  <p className="font-mono font-bold text-2xl text-[#0B1528] tabular-nums">
                    {activeOrders.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Achats livrés</p>
                  <p className="font-mono font-bold text-2xl text-emerald-700 tabular-nums">
                    {deliveredPurchases.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Articles favoris</p>
                  <p className="font-mono font-bold text-2xl text-[#0B1528] tabular-nums">
                    {favoriteProducts.length}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Panier actuel</p>
                  <p className="font-mono font-bold text-2xl text-orange-600 tabular-nums">
                    {cartCount}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setTab('panier')}
                  className="p-5 bg-white border border-slate-200 rounded-xl hover:border-orange-500 text-left flex items-center gap-3 cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-sm text-[#0B1528]">Mon panier</p>
                    <p className="text-xs text-slate-500">{cartCount} article(s)</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('messages')}
                  className="p-5 bg-white border border-slate-200 rounded-xl hover:border-orange-500 text-left flex items-center gap-3 cursor-pointer"
                >
                  <MessageSquare className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-sm text-[#0B1528]">Mes messages</p>
                    <p className="text-xs text-slate-500">{threads.length} conversation(s)</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('notifications')}
                  className="p-5 bg-white border border-slate-200 rounded-xl hover:border-orange-500 text-left flex items-center gap-3 cursor-pointer"
                >
                  <Bell className="w-5 h-5 text-orange-600 shrink-0" />
                  <div>
                    <p className="font-display font-semibold text-sm text-[#0B1528]">Notifications</p>
                    <p className="text-xs text-slate-500">{unreadNotifications} non lue(s)</p>
                  </div>
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-lg text-[#0B1528]">Commandes récentes</h2>
                  <button
                    type="button"
                    onClick={() => setTab('commandes')}
                    className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                  >
                    Tout voir →
                  </button>
                </div>
                {orders.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                    Aucune commande passée pour le moment.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 4).map((o) => (
                      <div
                        key={o.id}
                        className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-mono text-xs text-slate-500">{o.orderNumber}</p>
                          <p className="font-semibold text-sm text-[#0B1528]">{o.shopName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-sm text-[#0B1528] tabular-nums">
                            {formatFCFA(o.subtotal)}
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate(`/commande/${o.id}`)}
                            className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                          >
                            {ORDER_STATUS_LABELS[o.status]} · Suivre
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. MES COMMANDES */}
          {tab === 'commandes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Mes commandes</h2>
                <button
                  type="button"
                  onClick={() => navigate('/historique-commandes')}
                  className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                >
                  Vue historique complet →
                </button>
              </div>
              {orders.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Aucune commande trouvée.</p>
                </div>
              ) : (
                orders.map((o) => (
                  <div
                    key={o.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-16 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <SafeImage
                          src={o.items[0]?.imageUrl}
                          alt={o.items[0]?.name || o.shopName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono font-semibold text-[#0B1528]">{o.orderNumber}</span>
                          <span>·</span>
                          <span>{new Date(o.createdAt).toLocaleDateString('fr-FR')}</span>
                          <span>·</span>
                          <span>Paiement à la livraison</span>
                        </div>
                        <p className="font-display font-semibold text-base text-[#0B1528]">
                          Vendeur : {o.shopName}
                        </p>
                        <p className="text-xs text-slate-600 truncate">
                          {o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          Livraison : {o.deliveryAddress}, {o.customerCity}
                        </p>
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                      <span className="font-mono font-bold text-base text-[#0B1528] tabular-nums">
                        {formatFCFA(o.subtotal)}
                      </span>
                      <button
                        type="button"
                        onClick={() => navigate(`/commande/${o.id}`)}
                        className="px-3.5 py-1.5 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer"
                      >
                        {ORDER_STATUS_LABELS[o.status]} · Suivi →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 3. MES ACHATS (livrés) */}
          {tab === 'achats' && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-[#0B1528]">Mes achats finalisés</h2>
              {deliveredPurchases.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <CheckCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">
                    Vos commandes livrées apparaîtront ici avec leur récapitulatif d’achat.
                  </p>
                </div>
              ) : (
                deliveredPurchases.map((o) => (
                  <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <p className="font-mono text-xs text-slate-500">
                          {o.orderNumber} · Livré le {new Date(o.updatedAt).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="font-display font-semibold text-sm text-[#0B1528]">
                          Boutique : {o.shopName}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-base text-emerald-700 tabular-nums">
                        {formatFCFA(o.subtotal)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {o.items.map((item) => (
                        <div
                          key={`${o.id}-${item.productId}`}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <SafeImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate(`/produit/${item.productId}`)}
                              className="text-left font-medium text-[#0B1528] hover:text-orange-600 truncate cursor-pointer"
                            >
                              {item.quantity}× {item.name}
                            </button>
                          </div>
                          <span className="font-mono text-slate-600 tabular-nums shrink-0">
                            {formatFCFA(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => navigate(`/commande/${o.id}`)}
                        className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                      >
                        Voir le détail de la commande →
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* 4. MON PANIER */}
          {tab === 'panier' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Mon panier</h2>
                {cartLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate('/panier')}
                    className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                  >
                    Ouvrir la page panier →
                  </button>
                )}
              </div>

              {cartLines.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
                  <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm text-slate-600">Votre panier est vide.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/catalogue')}
                    className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer"
                  >
                    Explorer le catalogue
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="divide-y divide-slate-100">
                    {cartLines.map((line) => (
                      <div key={line.productId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-14 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <SafeImage
                              src={line.product.images[0]}
                              alt={line.product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(`/produit/${line.product.id}`)}
                              className="font-display font-semibold text-sm text-[#0B1528] hover:text-orange-600 truncate block text-left cursor-pointer"
                            >
                              {line.product.name}
                            </button>
                            <p className="text-xs text-slate-500 font-mono tabular-nums">
                              {formatFCFA(line.unitPrice)} / unité
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-4">
                          <div className="inline-flex items-center border border-slate-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() => updateCartQty(line.productId, line.quantity - 1)}
                              className="p-1.5 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                              aria-label="Diminuer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-mono font-semibold tabular-nums">
                              {line.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(line.productId, line.quantity + 1)}
                              className="p-1.5 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                              aria-label="Augmenter"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <span className="font-mono font-bold text-sm text-[#0B1528] tabular-nums">
                            {formatFCFA(line.lineTotal)}
                          </span>

                          <button
                            type="button"
                            onClick={() => removeFromCart(line.productId)}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                            aria-label="Retirer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Total panier (hors livraison éventuelle)</p>
                      <p className="font-mono font-bold text-xl text-orange-600 tabular-nums">
                        {formatFCFA(cartTotal)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/commande')}
                      className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold cursor-pointer"
                    >
                      Valider la commande
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. MES FAVORIS */}
          {tab === 'favoris' && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-[#0B1528]">Mes produits favoris</h2>
              {favoriteProducts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Heart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-600">Vous n’avez pas encore de produits favoris.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favoriteProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6. BOUTIQUES SUIVIES */}
          {tab === 'boutiques' && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-[#0B1528]">Boutiques suivies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {followedShops.length === 0 ? (
                  <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
                    Vous ne suivez aucune boutique pour le moment.
                  </div>
                ) : (
                  followedShops.map((s) => (
                    <div
                      key={s.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                          <SafeImage src={s.logoUrl} alt={s.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-display font-semibold text-sm text-[#0B1528] truncate">{s.name}</p>
                          <p className="text-xs text-slate-500">
                            {s.city} · {SHOP_STATUS_LABELS[s.verifiedStatus]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void toggleFollowShop(s.id)}
                          className="px-2.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:text-red-600 cursor-pointer"
                        >
                          Ne plus suivre
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/boutique/${s.slug}`)}
                          className="px-3.5 py-2 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer"
                        >
                          Visiter
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 7. MES NOTIFICATIONS */}
          {tab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Mes notifications</h2>
                {unreadNotifications > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllNotificationsRead()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>Tout marquer comme lu</span>
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Aucune notification pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => navigate(n.link || '/espace-client')}
                      className={`w-full text-left bg-white border rounded-xl p-4 flex items-start justify-between gap-4 hover:border-orange-500 cursor-pointer ${
                        n.read ? 'border-slate-200' : 'border-orange-300 bg-orange-50/30'
                      }`}
                    >
                      <div>
                        <p className="font-display font-semibold text-sm text-[#0B1528]">{n.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {new Date(n.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. MES MESSAGES */}
          {tab === 'messages' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Mes messages</h2>
                <button
                  type="button"
                  onClick={() => navigate('/messagerie')}
                  className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                >
                  Ouvrir en plein écran →
                </button>
              </div>

              {threads.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Aucune conversation pour le moment. Contactez une boutique depuis sa fiche produit.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[380px]">
                  <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                    {threads.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveThreadId(t.id)}
                        className={`w-full text-left p-3.5 cursor-pointer ${
                          activeThreadId === t.id ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-display font-semibold text-xs text-[#0B1528] truncate">
                          {t.vendorId === user.id ? t.clientName : t.shopName}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{t.lastMessage}</p>
                      </button>
                    ))}
                  </div>
                  <div className="md:col-span-8 flex flex-col h-[380px]">
                    <div className="flex-1 p-4 space-y-2.5 overflow-y-auto bg-slate-50">
                      {threadMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[80%] px-3.5 py-2 rounded-xl text-xs ${
                            m.senderId === user.id
                              ? 'ml-auto bg-[#0B1528] text-white'
                              : 'bg-white border border-slate-200 text-[#0B1528]'
                          }`}
                        >
                          <p>{m.text}</p>
                          <p className="text-[10px] opacity-60 mt-1">
                            {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendThreadMessage} className="p-3 border-t border-slate-200 flex gap-2">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Écrire un message..."
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <button
                        type="submit"
                        disabled={sendingMsg || !replyText.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Envoyer</span>
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 9. MON PROFIL & MOT DE PASSE */}
          {tab === 'profil' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveProfile}
                className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h2 className="font-display font-bold text-lg text-[#0B1528]">Informations personnelles</h2>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Photo de profil</label>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <SafeImage src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                    </div>
                    <input type="file" accept="image/*" onChange={handleAvatarUpload} className="text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Identifiant utilisateur
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={user.id}
                      className="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Date d’inscription
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={registrationDate}
                      className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Adresse email</label>
                  <input
                    type="email"
                    readOnly
                    value={user.email}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nom et prénom</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Téléphone</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ville</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {NIGER_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-sm font-semibold cursor-pointer"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </button>
              </form>

              <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-orange-600" />
                  <h2 className="font-display font-bold text-lg text-[#0B1528]">Gestion du mot de passe</h2>
                </div>

                {hasPasswordProvider ? (
                  <form onSubmit={handleUpdatePassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Mot de passe actuel
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nouveau mot de passe
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Confirmer le nouveau mot de passe
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={updatingPassword}
                      className="w-full py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-xs font-semibold cursor-pointer"
                    >
                      {updatingPassword ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Vous êtes connecté via un fournisseur externe (Google). Pour définir ou modifier un
                    mot de passe associé à <strong>{user.email}</strong>, utilisez l’envoi d’un lien de
                    réinitialisation ci-dessous.
                  </p>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={sendingReset}
                    onClick={handleSendResetEmail}
                    className="w-full py-2.5 rounded-lg border border-slate-300 hover:border-orange-500 text-xs font-semibold text-[#0B1528] cursor-pointer"
                  >
                    {sendingReset ? 'Envoi en cours...' : 'Envoyer un lien de réinitialisation par email'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
