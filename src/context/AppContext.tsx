import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CATEGORIES } from '../constants';
import { useAuth } from './AuthContext';
import {
  ensureUserProfile,
  fetchCategories,
  fetchMyStore,
  fetchUserProfile,
  markAllNotificationsReadDocs,
  saveUserCartDoc,
  subscribeNotifications,
  toggleFavoriteDoc,
  toggleFollowShopDoc,
} from '../lib/firestoreService';
import type {
  CartItem,
  CategoryItem,
  NotificationItem,
  Shop,
  User,
} from '../types';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface AppContextValue {
  path: string;
  navigate: (to: string) => void;
  user: User | null;
  vendorShop: Shop | null;
  authLoading: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
  cart: CartItem[];
  cartCount: number;
  addToCart: (productId: string, qty?: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => Promise<void>;
  toggleFollowShop: (shopId: string) => Promise<void>;
  notifications: NotificationItem[];
  unreadNotifications: number;
  markAllNotificationsRead: () => Promise<void>;
  categories: CategoryItem[];
  ws: WebSocket | null;
  showToast: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const CART_STORAGE_KEY = 'tsm_cart_v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading: firebaseAuthLoading, signOut: firebaseSignOut } = useAuth();
  const [path, setPath] = useState<string>(() => window.location.pathname + window.location.search);
  const [user, setUser] = useState<User | null>(null);
  const [vendorShop, setVendorShop] = useState<Shop | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const hydratedCartUidRef = useRef<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    if (!user || hydratedCartUidRef.current !== user.id) return;
    const timer = window.setTimeout(() => {
      void saveUserCartDoc(user.id, cart);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cart, user]);

  const showToast = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const navigate = useCallback((to: string) => {
    if (to === window.location.pathname + window.location.search) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!currentUser) {
      setUser(null);
      setVendorShop(null);
      setAuthLoading(false);
      return;
    }
    try {
      let profile: User;
      try {
        profile = await fetchUserProfile(currentUser.uid);
      } catch {
        profile = await ensureUserProfile({
          uid: currentUser.uid,
          fullName: currentUser.displayName || 'Utilisateur TSM',
          email: currentUser.email || `${currentUser.uid}@tsm.local`,
          photoURL: currentUser.photoURL || '',
        });
      }
      if (profile.suspended) {
        await firebaseSignOut();
        setUser(null);
        setVendorShop(null);
        showToast('Ce compte a été suspendu par l’administration.', 'error');
        return;
      }
      const shop = await fetchMyStore(currentUser.uid);
      if (hydratedCartUidRef.current !== profile.id) {
        hydratedCartUidRef.current = profile.id;
        const remoteCart = profile.cart || [];
        setCart((localCart) => {
          if (localCart.length === 0) return remoteCart;
          const mergedMap = new Map<string, number>();
          for (const item of remoteCart) {
            mergedMap.set(item.productId, item.quantity);
          }
          for (const item of localCart) {
            mergedMap.set(item.productId, Math.max(mergedMap.get(item.productId) || 0, item.quantity));
          }
          const merged = Array.from(mergedMap.entries())
            .map(([productId, quantity]) => ({ productId, quantity }))
            .slice(0, 50);
          void saveUserCartDoc(profile.id, merged);
          return merged;
        });
      }
      setUser(profile);
      setVendorShop(shop);
    } catch (err) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  }, [currentUser, firebaseSignOut, showToast]);

  // Sync Firestore user profile & real-time notifications with AuthContext state
  useEffect(() => {
    if (firebaseAuthLoading) return;

    if (!currentUser) {
      setUser(null);
      setVendorShop(null);
      setNotifications([]);
      setAuthLoading(false);
      return;
    }

    let active = true;
    void refreshAuth();
    const unsubNotifications = subscribeNotifications(currentUser.uid, (list) => {
      if (active) setNotifications(list);
    });

    return () => {
      active = false;
      unsubNotifications();
    };
  }, [currentUser, firebaseAuthLoading, refreshAuth]);

  useEffect(() => {
    fetchCategories()
      .then((cats) => {
        if (cats.length > 0) setCategories(cats);
      })
      .catch(() => {});
  }, []);

  // WebSocket signaling relay for Live Shopping WebRTC camera streams
  useEffect(() => {
    let closedByEffect = false;
    let reconnectTimer: number | null = null;

    function connect() {
      if (closedByEffect) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = socket;
      setWsInstance(socket);

      socket.onclose = () => {
        if (!closedByEffect) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      };
    }

    connect();
    return () => {
      closedByEffect = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      if (user) {
        await saveUserCartDoc(user.id, cart);
      }
      await firebaseSignOut();
    } catch {
      // ignore
    }
    hydratedCartUidRef.current = null;
    setCart([]);
    setUser(null);
    setVendorShop(null);
    setNotifications([]);
    showToast('Vous êtes déconnecté.', 'info');
    navigate('/');
  }, [cart, firebaseSignOut, navigate, showToast, user]);

  const addToCart = useCallback(
    (productId: string, qty = 1) => {
      setCart((prev) => {
        const idx = prev.findIndex((i) => i.productId === productId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
          return next;
        }
        return [...prev, { productId, quantity: qty }];
      });
      showToast('Produit ajouté au panier.', 'success');
    },
    [showToast],
  );

  const updateCartQty = useCallback((productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity: qty } : i)));
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (!user) {
        showToast('Connectez-vous pour enregistrer vos favoris.', 'info');
        navigate('/connexion');
        return;
      }
      try {
        const currentlyFav = user.favorites.includes(productId);
        const added = await toggleFavoriteDoc(user.id, productId, currentlyFav);
        setUser((prev) => {
          if (!prev) return prev;
          const nextFavs = added
            ? [...prev.favorites, productId]
            : prev.favorites.filter((id) => id !== productId);
          return { ...prev, favorites: nextFavs };
        });
        showToast(added ? 'Ajouté aux favoris.' : 'Retiré des favoris.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erreur favoris.', 'error');
      }
    },
    [navigate, showToast, user],
  );

  const toggleFollowShop = useCallback(
    async (shopId: string) => {
      if (!user) {
        showToast('Connectez-vous pour suivre cette boutique.', 'info');
        navigate('/connexion');
        return;
      }
      try {
        const next = await toggleFollowShopDoc(user.id, shopId, user.followedShopIds);
        setUser((prev) => (prev ? { ...prev, followedShopIds: next } : prev));
        const isFollowing = next.includes(shopId);
        showToast(isFollowing ? 'Boutique suivie.' : 'Vous ne suivez plus cette boutique.', 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Erreur suivi boutique.', 'error');
      }
    },
    [navigate, showToast, user],
  );

  const markAllNotificationsRead = useCallback(async () => {
    try {
      await markAllNotificationsReadDocs(notifications);
    } catch {
      // ignore
    }
  }, [notifications]);

  const cartCount = useMemo(() => cart.reduce((acc, i) => acc + i.quantity, 0), [cart]);
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const value: AppContextValue = {
    path,
    navigate,
    user,
    vendorShop,
    authLoading,
    refreshAuth,
    logout,
    cart,
    cartCount,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    toggleFavorite,
    toggleFollowShop,
    notifications,
    unreadNotifications,
    markAllNotificationsRead,
    categories,
    ws: wsInstance,
    showToast,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg border text-sm font-medium transition-all ${
              t.tone === 'error'
                ? 'bg-red-950 text-white border-red-800'
                : t.tone === 'success'
                  ? 'bg-[#0B1528] text-white border-orange-500/40'
                  : 'bg-[#0B1528] text-slate-100 border-slate-700'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp doit être utilisé dans AppProvider.');
  return ctx;
}
