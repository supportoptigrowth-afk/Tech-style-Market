import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_CATEGORIES } from '../constants';
import type {
  CartItem,
  CategoryItem,
  DirectMessage,
  GlobalOrder,
  LiveComment,
  LiveSession,
  MessageThread,
  NotificationItem,
  OrderItemSnapshot,
  OrderStatus,
  Product,
  ProductImageMeta,
  ProductStatus,
  ProductWithShop,
  ReportItem,
  Review,
  Shop,
  ShopStatus,
  SubOrder,
  User,
  UserRole,
} from '../types';
import { OperationType, auth, db, handleFirestoreError } from './firebase';
import { deleteAllProductMedia } from './mediaService';
import { parseStrictYouTubeUrl } from './youtube';

// ==================== HELPERS ====================
export function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function slugifyText(raw: string): string {
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return clean.length >= 3 ? clean : `tsm-${Math.random().toString(36).slice(2, 6)}`;
}

function clampStr(val: unknown, maxLen: number): string {
  return typeof val === 'string' ? val.trim().slice(0, maxLen) : '';
}

function generateReference(prefix: string): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  const stamp = Date.now().toString().slice(-4);
  return `${prefix}-${stamp}${rand}`;
}

// ==================== MAPPERS ====================
function mapStoreDoc(raw: Record<string, unknown>, id: string): Shop {
  return {
    id: String(raw.storeId || id),
    ownerId: String(raw.ownerId || ''),
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    logoUrl: String(raw.logo || ''),
    coverUrl: String(raw.coverImage || ''),
    description: String(raw.description || ''),
    city: String(raw.city || 'Niamey'),
    contactInfo: String(raw.contactInfo || ''),
    whatsappNumber: String(raw.whatsapp || ''),
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : [],
    acceptedVendorTerms: Boolean(raw.acceptedVendorTerms),
    verifiedStatus: (raw.verificationStatus as ShopStatus) || 'unverified',
    certificationRequested: Boolean(raw.certificationRequested),
    deliveryFee: typeof raw.deliveryFee === 'number' ? Number(raw.deliveryFee) : 0,
    visitorCount: Number(raw.visitorCount || 0),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function normalizeProductImages(
  rawImages: unknown,
  rawMeta: unknown,
  fallbackCreatedAt: string,
  sellerId?: string,
): { images: string[]; productImages: ProductImageMeta[] } {
  const urls = Array.isArray(rawImages)
    ? rawImages.map(String).filter((u) => u.trim().length > 0).slice(0, 8)
    : [];

  if (Array.isArray(rawMeta) && rawMeta.length > 0) {
    const parsed: ProductImageMeta[] = rawMeta
      .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object' && 'url' in m))
      .map((m, idx) => ({
        fileId: String(m.fileId || m.publicId || `legacy_${idx + 1}`),
        ...(typeof m.publicId === 'string' && m.publicId ? { publicId: m.publicId } : {}),
        ...(typeof m.fileName === 'string' && m.fileName ? { fileName: m.fileName } : {}),
        ...(typeof m.ownerId === 'string' && m.ownerId
          ? { ownerId: m.ownerId }
          : sellerId
            ? { ownerId: sellerId }
            : {}),
        url: String(m.url || ''),
        ...(typeof m.storagePath === 'string' && m.storagePath ? { storagePath: m.storagePath } : {}),
        isPrimary: Boolean(m.isPrimary),
        order: typeof m.order === 'number' ? Number(m.order) : idx + 1,
        uploadedAt: String(m.uploadedAt || fallbackCreatedAt),
      }))
      .filter((m) => m.url.trim().length > 0)
      .sort((a, b) => a.order - b.order)
      .slice(0, 8);

    if (parsed.length > 0) {
      if (!parsed.some((p) => p.isPrimary)) {
        parsed[0].isPrimary = true;
      }
      const ordered = [...parsed].sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.order - b.order;
      });
      return {
        images: ordered.map((p) => p.url),
        productImages: ordered.map((p, idx) => ({
          ...p,
          order: idx + 1,
          isPrimary: idx === 0,
        })),
      };
    }
  }

  return {
    images: urls,
    productImages: urls.map((url, idx) => ({
      fileId: `legacy_${idx + 1}`,
      ...(sellerId ? { ownerId: sellerId } : {}),
      url,
      isPrimary: idx === 0,
      order: idx + 1,
      uploadedAt: fallbackCreatedAt,
    })),
  };
}

function mapProductDoc(raw: Record<string, unknown>, id: string): Product {
  const createdAt = String(raw.createdAt || new Date().toISOString());
  const sellerId = String(raw.sellerId || '');
  const normalized = normalizeProductImages(raw.images, raw.productImages, createdAt, sellerId);
  return {
    id: String(raw.productId || id),
    reference: String(raw.reference || ''),
    shopId: String(raw.storeId || ''),
    vendorId: String(raw.sellerId || ''),
    name: String(raw.name || ''),
    description: String(raw.description || ''),
    price: Number(raw.price || 0),
    promoPrice: typeof raw.promoPrice === 'number' ? raw.promoPrice : null,
    images: normalized.images,
    productImages: normalized.productImages,
    category: String(raw.category || ''),
    stock: Number(raw.stock || 0),
    status: (raw.status as ProductStatus) || 'disponible',
    city: String(raw.city || 'Niamey'),
    condition: typeof raw.condition === 'string' ? raw.condition : undefined,
    additionalInfo: typeof raw.additionalInfo === 'string' ? raw.additionalInfo : undefined,
    salesCount: Number(raw.salesCount || 0),
    featured: Boolean(raw.featured),
    createdAt,
    updatedAt: String(raw.updatedAt || createdAt),
  };
}

function mapOrderDoc(raw: Record<string, unknown>, id: string): SubOrder {
  const totalAmount = Number(raw.totalAmount || 0);
  const deliveryFee = typeof raw.deliveryFee === 'number' ? Number(raw.deliveryFee) : 0;
  const itemsSubtotal =
    typeof raw.itemsSubtotal === 'number'
      ? Number(raw.itemsSubtotal)
      : Math.max(0, totalAmount - deliveryFee);

  return {
    id: String(raw.orderId || id),
    orderNumber: String(raw.orderNumber || ''),
    globalOrderId: String(raw.globalOrderNumber || ''),
    globalOrderNumber: String(raw.globalOrderNumber || ''),
    clientId: String(raw.customerId || ''),
    vendorId: String(raw.sellerId || ''),
    shopId: String(raw.storeId || ''),
    shopName: String(raw.storeName || ''),
    shopSlug: String(raw.storeSlug || ''),
    shopWhatsapp: String(raw.storeWhatsapp || ''),
    items: Array.isArray(raw.items) ? (raw.items as OrderItemSnapshot[]) : [],
    itemsSubtotal,
    deliveryFee,
    subtotal: totalAmount,
    status: (raw.orderStatus as OrderStatus) || 'en_attente',
    customerName: String(raw.customerName || ''),
    customerPhone: String(raw.phone || ''),
    customerCity: String(raw.city || ''),
    deliveryAddress: String(raw.deliveryAddress || ''),
    paymentMethod: 'paiement_a_la_livraison',
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
  };
}

function mapLiveDoc(raw: Record<string, unknown>, id: string): LiveSession {
  const rawUrl = String(raw.youtubeUrl || raw.streamUrl || '');
  const parsedYt = parseStrictYouTubeUrl(rawUrl);
  const videoId = String(raw.youtubeVideoId || parsedYt?.videoId || '');
  const embedUrl =
    typeof raw.embedUrl === 'string' && raw.embedUrl.startsWith('https://www.youtube.com/embed/')
      ? raw.embedUrl
      : parsedYt?.embedUrl || (videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : '');

  return {
    id: String(raw.liveId || id),
    slug: String(raw.slug || ''),
    shopId: String(raw.storeId || ''),
    vendorId: String(raw.sellerId || ''),
    shopName: String(raw.storeName || ''),
    shopSlug: String(raw.storeSlug || ''),
    title: String(raw.title || ''),
    description: String(raw.description || ''),
    category: String(raw.category || 'Autres produits'),
    coverUrl: String(raw.coverImage || ''),
    status: (raw.status as LiveSession['status']) || 'programme',
    streamType: (raw.streamProvider as LiveSession['streamType']) || 'youtube',
    streamUrl: String(raw.streamUrl || rawUrl),
    youtubeUrl: String(raw.youtubeUrl || parsedYt?.youtubeUrl || rawUrl),
    youtubeVideoId: videoId,
    embedUrl,
    scheduledAt: String(raw.scheduledAt || new Date().toISOString()),
    startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : null,
    endedAt: typeof raw.endedAt === 'string' ? raw.endedAt : null,
    productIds: Array.isArray(raw.productIds) ? raw.productIds.map(String) : [],
    featuredProductId: typeof raw.featuredProductId === 'string' && raw.featuredProductId ? raw.featuredProductId : null,
    moderatedHidden: Boolean(raw.moderatedHidden),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function mapReviewDoc(raw: Record<string, unknown>, id: string): Review {
  return {
    id: String(raw.reviewId || id),
    productId: String(raw.productId || ''),
    shopId: String(raw.storeId || ''),
    userId: String(raw.userId || ''),
    userName: String(raw.userName || ''),
    rating: Number(raw.rating || 5),
    comment: String(raw.comment || ''),
    vendorReply: typeof raw.vendorReply === 'string' ? raw.vendorReply : null,
    hidden: Boolean(raw.hidden),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function mapNotificationDoc(raw: Record<string, unknown>, id: string): NotificationItem {
  return {
    id: String(raw.notificationId || id),
    userId: String(raw.userId || ''),
    type: (raw.type as NotificationItem['type']) || 'systeme',
    title: String(raw.title || ''),
    message: String(raw.message || ''),
    link: String(raw.link || '/espace-client'),
    read: Boolean(raw.read),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

function mapReportDoc(raw: Record<string, unknown>, id: string): ReportItem {
  return {
    id: String(raw.reportId || id),
    reporterId: String(raw.reporterId || ''),
    reporterName: String(raw.reporterName || ''),
    targetType: (raw.targetType as ReportItem['targetType']) || 'product',
    targetId: String(raw.targetId || ''),
    targetLabel: String(raw.targetLabel || ''),
    reason: String(raw.reason || ''),
    status: (raw.status as ReportItem['status']) || 'ouvert',
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

// ==================== AUTH & USERS ====================
export async function checkIsAdmin(
  uid: string,
  email?: string | null,
  emailVerified?: boolean,
): Promise<boolean> {
  if (email === 'support.optigrowth@gmail.com' && emailVerified === true) {
    return true;
  }
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch (err) {
    // Only fail closed if admins doc does not exist or permission denied on non-admin
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
      return false;
    }
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function ensureUserProfile(params: {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  city?: string;
  photoURL?: string;
  roles?: Array<'client' | 'vendor'>;
}): Promise<User> {
  const userPath = `users/${params.uid}`;
  try {
    const ref = doc(db, 'users', params.uid);
    const snap = await getDoc(ref);
    const nowIso = new Date().toISOString();

    if (!snap.exists()) {
      const safeRoles: Array<'client' | 'vendor'> =
        params.roles && params.roles.length > 0
          ? params.roles.filter((r): r is 'client' | 'vendor' => r === 'client' || r === 'vendor')
          : ['client'];
      if (safeRoles.length === 0) safeRoles.push('client');

      const docData = {
        uid: params.uid,
        fullName: clampStr(params.fullName, 100).length >= 2 ? clampStr(params.fullName, 100) : 'Utilisateur TSM',
        email: clampStr(params.email, 150) || `${params.uid}@tsm.local`,
        phone: clampStr(params.phone || '', 30),
        city: clampStr(params.city || 'Niamey', 60) || 'Niamey',
        photoURL: clampStr(params.photoURL || '', 1000),
        roles: safeRoles,
        suspended: false,
        followedStoreIds: [] as string[],
        cart: [] as CartItem[],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      await setDoc(ref, docData);
      const isAdmin = await checkIsAdmin(
        params.uid,
        auth.currentUser?.email,
        auth.currentUser?.emailVerified,
      );
      return {
        id: docData.uid,
        fullName: docData.fullName,
        email: docData.email,
        phone: docData.phone,
        city: docData.city,
        avatarUrl: docData.photoURL,
        roles: isAdmin ? [...docData.roles, 'admin'] : docData.roles,
        suspended: false,
        favorites: [],
        followedShopIds: [],
        cart: [],
        createdAt: docData.createdAt,
      };
    }

    return await fetchUserProfile(params.uid);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function fetchUserProfile(uid: string): Promise<User> {
  const userPath = `users/${uid}`;
  let data: Record<string, unknown>;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      throw new Error('Profil utilisateur introuvable.');
    }
    data = snap.data();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  let favoriteIds: string[] = [];
  try {
    const favSnap = await getDocs(query(collection(db, 'favorites'), where('userId', '==', uid)));
    favoriteIds = favSnap.docs.map((d) => String(d.data().productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'favorites');
  }

  const isAdmin = await checkIsAdmin(
    uid,
    auth.currentUser?.email,
    auth.currentUser?.emailVerified,
  );
  const rawRoles = Array.isArray(data.roles)
    ? data.roles.filter((r): r is UserRole => r === 'client' || r === 'vendor')
    : ['client' as UserRole];
  const roles: UserRole[] = isAdmin && !rawRoles.includes('admin') ? [...rawRoles, 'admin'] : rawRoles;

  const cart: CartItem[] = Array.isArray(data.cart)
    ? data.cart
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object' && 'productId' in c))
        .map((c) => ({
          productId: String(c.productId),
          quantity: Math.max(1, Math.floor(Number(c.quantity || 1))),
        }))
        .slice(0, 50)
    : [];

  return {
    id: String(data.uid || uid),
    fullName: String(data.fullName || ''),
    email: String(data.email || ''),
    phone: String(data.phone || ''),
    city: String(data.city || 'Niamey'),
    avatarUrl: String(data.photoURL || ''),
    roles,
    suspended: Boolean(data.suspended),
    favorites: favoriteIds,
    followedShopIds: Array.isArray(data.followedStoreIds) ? data.followedStoreIds.map(String) : [],
    cart,
    createdAt: String(data.createdAt || new Date().toISOString()),
  };
}

export async function saveUserCartDoc(uid: string, cart: CartItem[]): Promise<void> {
  const cleanCart = cart
    .filter((i) => i.productId && i.quantity >= 1)
    .map((i) => ({
      productId: clampStr(i.productId, 128),
      quantity: Math.max(1, Math.floor(Number(i.quantity))),
    }))
    .slice(0, 50);
  try {
    await updateDoc(doc(db, 'users', uid), {
      cart: cleanCart,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Best-effort Firestore sync alongside localStorage
  }
}

export async function updateUserProfileDoc(
  uid: string,
  updates: { fullName: string; phone: string; city: string; photoURL: string },
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fullName: clampStr(updates.fullName, 100),
      phone: clampStr(updates.phone, 30),
      city: clampStr(updates.city, 60) || 'Niamey',
      photoURL: clampStr(updates.photoURL, 1000),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function activateVendorRoleDoc(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      roles: ['client', 'vendor'],
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function toggleFavoriteDoc(
  uid: string,
  productId: string,
  currentlyFav: boolean,
): Promise<boolean> {
  const favoriteId = `${uid}_${productId}`;
  const path = `favorites/${favoriteId}`;
  try {
    if (currentlyFav) {
      await deleteDoc(doc(db, 'favorites', favoriteId));
      return false;
    }
    await setDoc(doc(db, 'favorites', favoriteId), {
      favoriteId,
      userId: uid,
      productId,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    handleFirestoreError(err, currentlyFav ? OperationType.DELETE : OperationType.CREATE, path);
  }
}

export async function toggleFollowShopDoc(
  uid: string,
  storeId: string,
  currentFollowed: string[],
): Promise<string[]> {
  const path = `users/${uid}`;
  const exists = currentFollowed.includes(storeId);
  const next = exists
    ? currentFollowed.filter((id) => id !== storeId)
    : [...currentFollowed, storeId].slice(0, 200);
  const followId = `${uid}_${storeId}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      followedStoreIds: next,
      updatedAt: new Date().toISOString(),
    });

    // Keep privacy-safe storeFollowers index in sync for Live Shopping notifications
    if (exists) {
      await deleteDoc(doc(db, 'storeFollowers', followId)).catch(() => {});
    } else {
      const storeSnap = await getDoc(doc(db, 'stores', storeId)).catch(() => null);
      const storeOwnerId = storeSnap?.exists() ? String(storeSnap.data()?.ownerId || '') : '';
      if (storeOwnerId) {
        await setDoc(doc(db, 'storeFollowers', followId), {
          followId,
          userId: uid,
          storeId,
          storeOwnerId,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    return next;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ==================== STORES ====================
export async function fetchMyStore(ownerId: string): Promise<Shop | null> {
  try {
    const snap = await getDocs(query(collection(db, 'stores'), where('ownerId', '==', ownerId)));
    if (snap.empty) return null;
    const d = snap.docs[0];
    return mapStoreDoc(d.data(), d.id);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'stores');
  }
}

export async function fetchPublicStores(): Promise<Shop[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'stores'), where('verificationStatus', 'in', ['unverified', 'pending', 'verified'])),
    );
    return snap.docs
      .map((d) => mapStoreDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'stores');
  }
}

export async function fetchPublicStoresWithStats(): Promise<
  Array<Shop & { productCount: number; avgRating: number | null; reviewCount: number }>
> {
  const [stores, products, reviews] = await Promise.all([
    fetchPublicStores(),
    fetchPublicProductsRaw(),
    fetchPublicReviews(),
  ]);
  return stores.map((s) => {
    const prodCount = products.filter((p) => p.shopId === s.id).length;
    const shopReviews = reviews.filter((r) => r.shopId === s.id);
    const avgRating =
      shopReviews.length > 0
        ? Number((shopReviews.reduce((acc, r) => acc + r.rating, 0) / shopReviews.length).toFixed(1))
        : null;
    return { ...s, productCount: prodCount, avgRating, reviewCount: shopReviews.length };
  });
}

export async function fetchPublicShopDetails(slugOrId: string): Promise<{
  shop: Shop;
  products: Product[];
  reviews: Review[];
  lives: LiveSession[];
}> {
  const [stores, products, reviews, lives] = await Promise.all([
    fetchPublicStores(),
    fetchPublicProductsRaw(),
    fetchPublicReviews(),
    fetchPublicLives(),
  ]);
  const shop = stores.find((s) => s.slug === slugOrId || s.id === slugOrId);
  if (!shop) {
    throw new Error('Boutique introuvable ou indisponible.');
  }

  // Increment visitor count on Firestore (best effort)
  try {
    await updateDoc(doc(db, 'stores', shop.id), {
      visitorCount: (shop.visitorCount || 0) + 1,
    });
    shop.visitorCount += 1;
  } catch {
    // Non-blocking if concurrent or offline
  }

  return {
    shop,
    products: products.filter((p) => p.shopId === shop.id),
    reviews: reviews.filter((r) => r.shopId === shop.id),
    lives: lives.filter((l) => l.shopId === shop.id),
  };
}

export async function createStoreDoc(
  uid: string,
  payload: {
    name: string;
    slug: string;
    city: string;
    description: string;
    contactInfo: string;
    whatsappNumber: string;
    logoUrl: string;
    coverUrl: string;
    categories?: string[];
    deliveryFee?: number;
    acceptedVendorTerms: boolean;
    certificationRequested: boolean;
  },
): Promise<Shop> {
  const existing = await fetchMyStore(uid);
  if (existing) {
    throw new Error('Vous possédez déjà une boutique.');
  }
  if (!payload.acceptedVendorTerms) {
    throw new Error('Vous devez accepter les conditions vendeurs pour ouvrir votre boutique.');
  }
  const name = clampStr(payload.name, 80);
  if (name.length < 3) {
    throw new Error('Le nom de la boutique doit contenir au moins 3 caractères.');
  }
  let slug = slugifyText(payload.slug || name);
  const allStores = await fetchPublicStores();
  if (allStores.some((s) => s.slug === slug)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 80);
  }

  const cleanCategories = Array.isArray(payload.categories)
    ? payload.categories.map((c) => clampStr(c, 80)).filter(Boolean).slice(0, 15)
    : [];
  const deliveryFee = Math.max(0, Math.min(5000000, Math.round(Number(payload.deliveryFee || 0))));

  const storeId = generateDocId('shop');
  const nowIso = new Date().toISOString();
  const docData = {
    storeId,
    ownerId: uid,
    name,
    description: clampStr(payload.description, 1500),
    logo: clampStr(payload.logoUrl, 1000),
    coverImage: clampStr(payload.coverUrl, 1000),
    whatsapp: clampStr(payload.whatsappNumber, 30),
    contactInfo: clampStr(payload.contactInfo, 250),
    city: clampStr(payload.city || 'Niamey', 60) || 'Niamey',
    slug,
    categories: cleanCategories,
    acceptedVendorTerms: true,
    verificationStatus: payload.certificationRequested ? ('pending' as const) : ('unverified' as const),
    certificationRequested: Boolean(payload.certificationRequested),
    deliveryFee,
    visitorCount: 0,
    createdAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'stores', storeId), docData);
    await activateVendorRoleDoc(uid);
    return mapStoreDoc(docData, storeId);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `stores/${storeId}`);
  }
}

export async function updateStoreDoc(
  storeId: string,
  payload: {
    name: string;
    slug: string;
    city: string;
    whatsappNumber: string;
    contactInfo: string;
    description: string;
    logoUrl?: string;
    coverUrl?: string;
    categories?: string[];
    deliveryFee?: number;
  },
): Promise<void> {
  const path = `stores/${storeId}`;
  const name = clampStr(payload.name, 80);
  if (name.length < 3) throw new Error('Nom de boutique trop court (min. 3 caractères).');

  let slug = slugifyText(payload.slug || name);
  const allStores = await fetchPublicStores();
  if (allStores.some((s) => s.slug === slug && s.id !== storeId)) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 80);
  }

  const updateData: Record<string, unknown> = {
    name,
    slug,
    city: clampStr(payload.city, 60) || 'Niamey',
    whatsapp: clampStr(payload.whatsappNumber, 30),
    contactInfo: clampStr(payload.contactInfo, 250),
    description: clampStr(payload.description, 1500),
  };
  if (payload.logoUrl !== undefined) updateData.logo = clampStr(payload.logoUrl, 1000);
  if (payload.coverUrl !== undefined) updateData.coverImage = clampStr(payload.coverUrl, 1000);
  if (payload.deliveryFee !== undefined) {
    updateData.deliveryFee = Math.max(0, Math.min(5000000, Math.round(Number(payload.deliveryFee || 0))));
  }
  if (Array.isArray(payload.categories)) {
    updateData.categories = payload.categories.map((c) => clampStr(c, 80)).filter(Boolean).slice(0, 15);
  }

  try {
    await updateDoc(doc(db, 'stores', storeId), updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function requestStoreCertificationDoc(storeId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'stores', storeId), {
      certificationRequested: true,
      verificationStatus: 'pending',
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `stores/${storeId}`);
  }
}

// ==================== PRODUCTS & CATALOG ====================
async function fetchPublicProductsRaw(): Promise<Product[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'products'), where('status', 'in', ['disponible', 'rupture'])),
    );
    return snap.docs.map((d) => mapProductDoc(d.data(), d.id));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
  }
}

export async function fetchPublicCatalog(filters?: {
  q?: string;
  category?: string;
  city?: string;
  shopId?: string;
  inStockOnly?: boolean;
  promoOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
}): Promise<ProductWithShop[]> {
  const [products, stores] = await Promise.all([fetchPublicProductsRaw(), fetchPublicStores()]);
  const storeMap = new Map(stores.map((s) => [s.id, s]));

  // Only include products belonging to non-suspended stores
  let items: ProductWithShop[] = products
    .filter((p) => storeMap.has(p.shopId))
    .map((p) => ({ ...p, shop: storeMap.get(p.shopId) }));

  if (filters) {
    const q = (filters.q || '').trim().toLowerCase();
    if (q) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.shop?.name || '').toLowerCase().includes(q),
      );
    }
    if (filters.category && filters.category !== 'Toutes') {
      items = items.filter((p) => p.category === filters.category);
    }
    if (filters.city && filters.city !== 'Toutes') {
      items = items.filter((p) => p.city === filters.city);
    }
    if (filters.shopId && filters.shopId !== 'Toutes') {
      items = items.filter((p) => p.shopId === filters.shopId);
    }
    if (filters.inStockOnly) {
      items = items.filter((p) => p.status === 'disponible' && p.stock > 0);
    }
    if (filters.promoOnly) {
      items = items.filter(
        (p) => typeof p.promoPrice === 'number' && p.promoPrice > 0 && p.promoPrice < p.price,
      );
    }
    if (filters.minPrice && filters.minPrice > 0) {
      items = items.filter((p) => (p.promoPrice ?? p.price) >= filters.minPrice!);
    }
    if (filters.maxPrice && filters.maxPrice > 0) {
      items = items.filter((p) => (p.promoPrice ?? p.price) <= filters.maxPrice!);
    }

    if (filters.sort === 'price_asc') {
      items.sort((a, b) => (a.promoPrice ?? a.price) - (b.promoPrice ?? b.price));
    } else if (filters.sort === 'price_desc') {
      items.sort((a, b) => (b.promoPrice ?? b.price) - (a.promoPrice ?? a.price));
    } else if (filters.sort === 'popular') {
      items.sort((a, b) => b.salesCount - a.salesCount);
    } else {
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  } else {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return items;
}

export async function fetchProductDetails(productIdOrRef: string): Promise<{
  product: Product;
  shop: Shop | null;
  reviews: Review[];
}> {
  let product: Product | null = null;
  try {
    const snap = await getDoc(doc(db, 'products', productIdOrRef));
    if (snap.exists()) {
      product = mapProductDoc(snap.data(), snap.id);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('permission-denied') && !msg.includes('Missing or insufficient permissions')) {
      handleFirestoreError(err, OperationType.GET, `products/${productIdOrRef}`);
    }
  }

  if (!product) {
    const all = await fetchPublicProductsRaw();
    product = all.find((p) => p.id === productIdOrRef || p.reference === productIdOrRef) || null;
  }
  if (!product || product.status === 'masque') {
    throw new Error('Produit introuvable.');
  }

  let shop: Shop | null = null;
  try {
    const shopSnap = await getDoc(doc(db, 'stores', product.shopId));
    if (shopSnap.exists()) {
      shop = mapStoreDoc(shopSnap.data(), shopSnap.id);
    }
  } catch {
    shop = null;
  }

  const allReviews = await fetchPublicReviews();
  const reviews = allReviews.filter((r) => r.productId === product!.id);
  return { product, shop, reviews };
}

export async function fetchVendorProducts(sellerId: string): Promise<Product[]> {
  try {
    const snap = await getDocs(query(collection(db, 'products'), where('sellerId', '==', sellerId)));
    return snap.docs
      .map((d) => mapProductDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
  }
}

function prepareProductImagesPayload(
  productImagesInput?: ProductImageMeta[],
  fallbackImages?: string[],
  ownerId?: string,
): { images: string[]; productImages: ProductImageMeta[] } {
  const nowIso = new Date().toISOString();
  const baseList: ProductImageMeta[] =
    productImagesInput && productImagesInput.length > 0
      ? productImagesInput
          .filter((p) => p.url && p.url.trim().length > 0)
          .slice(0, 8)
          .map((p, idx) => ({
            fileId: p.publicId || p.fileId || `img_${idx + 1}`,
            ...(p.publicId ? { publicId: p.publicId } : {}),
            ...(p.fileName ? { fileName: p.fileName } : {}),
            ...(p.ownerId || ownerId ? { ownerId: p.ownerId || ownerId } : {}),
            url: p.url.trim(),
            ...(p.storagePath ? { storagePath: p.storagePath } : {}),
            isPrimary: Boolean(p.isPrimary),
            order: idx + 1,
            uploadedAt: p.uploadedAt || nowIso,
          }))
      : (fallbackImages || [])
          .filter((u) => u && u.trim().length > 0)
          .slice(0, 8)
          .map((url, idx) => ({
            fileId: `img_${idx + 1}`,
            ...(ownerId ? { ownerId } : {}),
            url: url.trim(),
            isPrimary: idx === 0,
            order: idx + 1,
            uploadedAt: nowIso,
          }));

  if (baseList.length === 0) {
    return { images: [], productImages: [] };
  }

  if (!baseList.some((p) => p.isPrimary)) {
    baseList[0].isPrimary = true;
  }

  const orderedForCatalog = [...baseList].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.order - b.order;
  });

  return {
    images: orderedForCatalog.map((p) => p.url),
    productImages: orderedForCatalog.map((p, idx) => ({
      ...p,
      order: idx + 1,
      isPrimary: idx === 0,
    })),
  };
}

export async function createProductDoc(
  uid: string,
  shop: Shop,
  payload: {
    productId?: string;
    name: string;
    description: string;
    category: string;
    price: number;
    promoPrice: number | null;
    stock: number;
    status: 'disponible' | 'brouillon' | 'rupture';
    city?: string;
    condition?: string;
    additionalInfo?: string;
    images: string[];
    productImages?: ProductImageMeta[];
  },
): Promise<Product> {
  if (shop.verifiedStatus === 'suspended') {
    throw new Error('Votre boutique est suspendue et ne peut pas publier de produits.');
  }
  const name = clampStr(payload.name, 150);
  if (name.length < 3) throw new Error('Le nom du produit doit contenir au moins 3 caractères.');
  const price = Math.round(Number(payload.price));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Prix en FCFA invalide.');
  const promoPrice =
    payload.promoPrice && Number(payload.promoPrice) > 0 ? Math.round(Number(payload.promoPrice)) : null;
  if (promoPrice !== null && promoPrice >= price) {
    throw new Error('Le prix promotionnel doit être inférieur au prix normal.');
  }
  const stock = Math.max(0, Math.floor(Number(payload.stock || 0)));

  const status: ProductStatus =
    stock === 0 && payload.status === 'disponible'
      ? 'rupture'
      : payload.status === 'brouillon'
        ? 'brouillon'
        : payload.status === 'rupture'
          ? 'rupture'
          : 'disponible';

  const { images, productImages } = prepareProductImagesPayload(payload.productImages, payload.images, uid);
  if (images.length === 0 && status !== 'brouillon') {
    throw new Error('Veuillez ajouter au moins une photo avant de publier ce produit.');
  }

  const productId = payload.productId || generateDocId('prod');
  const nowIso = new Date().toISOString();

  const docData = {
    productId,
    reference: generateReference('TSM'),
    sellerId: uid,
    storeId: shop.id,
    storeName: clampStr(shop.name, 100),
    storeSlug: clampStr(shop.slug, 80),
    storeWhatsapp: clampStr(shop.whatsappNumber, 30),
    name,
    description: clampStr(payload.description, 3000),
    price,
    promoPrice,
    category: clampStr(payload.category, 80),
    images,
    productImages,
    stock,
    status,
    city: clampStr(payload.city || shop.city, 60) || 'Niamey',
    condition: clampStr(payload.condition || 'Neuf', 60),
    additionalInfo: clampStr(payload.additionalInfo || '', 1500),
    salesCount: 0,
    featured: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'products', productId), docData);
    return mapProductDoc(docData, productId);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `products/${productId}`);
  }
}

export async function updateProductDoc(
  productId: string,
  payload: {
    name: string;
    description: string;
    category: string;
    price: number;
    promoPrice: number | null;
    stock: number;
    status: ProductStatus;
    city?: string;
    condition?: string;
    additionalInfo?: string;
    images: string[];
    productImages?: ProductImageMeta[];
  },
): Promise<void> {
  const name = clampStr(payload.name, 150);
  if (name.length < 3) throw new Error('Le nom du produit doit contenir au moins 3 caractères.');
  const price = Math.round(Number(payload.price));
  if (!Number.isFinite(price) || price <= 0) throw new Error('Prix invalide.');
  const promoPrice =
    payload.promoPrice && Number(payload.promoPrice) > 0 ? Math.round(Number(payload.promoPrice)) : null;
  if (promoPrice !== null && promoPrice >= price) {
    throw new Error('Le prix promotionnel doit être inférieur au prix normal.');
  }
  const stock = Math.max(0, Math.floor(Number(payload.stock || 0)));
  let status: ProductStatus = payload.status;
  if (stock === 0 && status === 'disponible') status = 'rupture';
  if (stock > 0 && status === 'rupture') status = 'disponible';

  const { images, productImages } = prepareProductImagesPayload(
    payload.productImages,
    payload.images,
    auth.currentUser?.uid,
  );
  if (images.length === 0 && status !== 'brouillon') {
    throw new Error('Veuillez conserver au moins une photo pour un produit publié.');
  }

  const updates: Record<string, unknown> = {
    name,
    description: clampStr(payload.description, 3000),
    category: clampStr(payload.category, 80),
    price,
    promoPrice,
    stock,
    status,
    images,
    productImages,
    updatedAt: new Date().toISOString(),
  };
  if (payload.city !== undefined) updates.city = clampStr(payload.city, 60) || 'Niamey';
  if (payload.condition !== undefined) updates.condition = clampStr(payload.condition, 60);
  if (payload.additionalInfo !== undefined) updates.additionalInfo = clampStr(payload.additionalInfo, 1500);

  try {
    await updateDoc(doc(db, 'products', productId), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
  }
}

export async function updateProductStockAndStatusDoc(
  productId: string,
  stock: number,
  status: ProductStatus,
): Promise<void> {
  const safeStock = Math.max(0, Math.floor(Number(stock || 0)));
  let nextStatus = status;
  if (safeStock === 0 && nextStatus === 'disponible') nextStatus = 'rupture';
  if (safeStock > 0 && nextStatus === 'rupture') nextStatus = 'disponible';
  try {
    await updateDoc(doc(db, 'products', productId), {
      stock: safeStock,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
  }
}

export async function deleteProductDoc(productId: string): Promise<void> {
  const refDoc = doc(db, 'products', productId);
  try {
    // Delete associated Cloudinary assets first while the Firestore ownership record exists
    await deleteAllProductMedia(productId);
    await deleteDoc(refDoc);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

// ==================== ORDERS (ATOMIC TRANSACTION) ====================
export async function placeOrderTransaction(params: {
  uid: string;
  items: Array<{ productId: string; quantity: number }>;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  deliveryAddress: string;
  notes?: string;
}): Promise<{ globalOrder: GlobalOrder; subOrders: SubOrder[] }> {
  if (!params.items.length) throw new Error('Votre panier est vide.');
  const customerName = clampStr(params.customerName, 100);
  const phone = clampStr(params.customerPhone, 30);
  const city = clampStr(params.customerCity || 'Niamey', 60);
  const deliveryAddress = clampStr(params.deliveryAddress, 350);
  const notes = clampStr(params.notes || '', 500);

  if (customerName.length < 2 || phone.length < 6 || deliveryAddress.length < 3) {
    throw new Error('Veuillez compléter vos coordonnées et l’adresse de livraison.');
  }

  const idempotencyKey = generateDocId('lock');
  const globalOrderNumber = generateReference('TSM');
  const nowIso = new Date().toISOString();

  try {
    return await runTransaction(db, async (tx) => {
      // Phase 1: All reads BEFORE writes
      const lockRef = doc(db, 'orderLocks', idempotencyKey);
      const lockSnap = await tx.get(lockRef);
      if (lockSnap.exists()) {
        throw new Error('Commande déjà enregistrée.');
      }

      const mergedQty = new Map<string, number>();
      for (const item of params.items) {
        const qty = Math.floor(Number(item.quantity || 0));
        if (!item.productId || qty <= 0) throw new Error('Quantité d’article invalide.');
        mergedQty.set(item.productId, (mergedQty.get(item.productId) || 0) + qty);
      }

      const productEntries = new Map<string, Record<string, unknown>>();
      const storeIds = new Set<string>();
      for (const productId of mergedQty.keys()) {
        const pSnap = await tx.get(doc(db, 'products', productId));
        if (!pSnap.exists()) throw new Error(`Produit introuvable (${productId}).`);
        const pData = pSnap.data();
        productEntries.set(productId, pData);
        storeIds.add(String(pData.storeId));
      }

      const storeEntries = new Map<string, Record<string, unknown>>();
      for (const storeId of storeIds) {
        const sSnap = await tx.get(doc(db, 'stores', storeId));
        if (!sSnap.exists()) throw new Error('Boutique introuvable.');
        storeEntries.set(storeId, sSnap.data());
      }

      // Phase 2: Validation & Grouping
      const groupedByStore = new Map<
        string,
        { store: Record<string, unknown>; items: OrderItemSnapshot[]; subtotal: number }
      >();
      const stockUpdates: Array<{
        productId: string;
        newStock: number;
        newSalesCount: number;
        newStatus: string;
      }> = [];

      for (const [productId, qty] of mergedQty.entries()) {
        const pData = productEntries.get(productId)!;
        const pName = String(pData.name || '');
        const pStatus = String(pData.status || '');
        const currentStock = Number(pData.stock || 0);
        const currentSales = Number(pData.salesCount || 0);
        const storeId = String(pData.storeId);
        const storeData = storeEntries.get(storeId)!;

        if (pStatus === 'masque' || pStatus === 'brouillon') {
          throw new Error(`Le produit "${pName}" n’est plus disponible.`);
        }
        if (storeData.verificationStatus === 'suspended') {
          throw new Error(`La boutique de "${pName}" est actuellement suspendue.`);
        }
        if (currentStock < qty) {
          throw new Error(`Stock insuffisant pour "${pName}" (disponible : ${currentStock}).`);
        }

        const basePrice = Number(pData.price || 0);
        const promo = typeof pData.promoPrice === 'number' ? pData.promoPrice : null;
        const unitPrice = promo && promo > 0 && promo < basePrice ? promo : basePrice;

        const snapshot: OrderItemSnapshot = {
          productId,
          reference: String(pData.reference || ''),
          name: pName,
          unitPrice,
          quantity: qty,
          imageUrl: Array.isArray(pData.images) && pData.images[0] ? String(pData.images[0]) : '',
          lineTotal: unitPrice * qty,
        };

        const newStock = currentStock - qty;
        stockUpdates.push({
          productId,
          newStock,
          newSalesCount: currentSales + qty,
          newStatus: newStock === 0 ? 'rupture' : pStatus,
        });

        const group = groupedByStore.get(storeId) || { store: storeData, items: [], subtotal: 0 };
        group.items.push(snapshot);
        group.subtotal += snapshot.lineTotal;
        groupedByStore.set(storeId, group);
      }

      // Phase 3: Atomic writes
      tx.set(lockRef, {
        lockId: idempotencyKey,
        customerId: params.uid,
        globalOrderNumber,
        createdAt: nowIso,
      });

      for (const upd of stockUpdates) {
        tx.update(doc(db, 'products', upd.productId), {
          stock: upd.newStock,
          salesCount: upd.newSalesCount,
          status: upd.newStatus,
          updatedAt: nowIso,
        });
      }

      const subOrders: SubOrder[] = [];
      let totalAmount = 0;
      let totalItemsSubtotal = 0;
      let totalDeliveryFee = 0;

      for (const [storeId, group] of groupedByStore.entries()) {
        const orderId = generateDocId('ord');
        const orderNumber = generateReference('CMD');
        const sellerId = String(group.store.ownerId);
        const storeName = clampStr(group.store.name, 100);
        const storeSlug = clampStr(group.store.slug, 80);
        const storeWhatsapp = clampStr(group.store.whatsapp || '', 30);
        const deliveryFee =
          typeof group.store.deliveryFee === 'number' && group.store.deliveryFee > 0
            ? Math.round(group.store.deliveryFee)
            : 0;
        const itemsSubtotal = group.subtotal;
        const storeTotal = itemsSubtotal + deliveryFee;

        totalItemsSubtotal += itemsSubtotal;
        totalDeliveryFee += deliveryFee;
        totalAmount += storeTotal;

        const orderDoc = {
          orderId,
          orderNumber,
          globalOrderNumber,
          customerId: params.uid,
          sellerId,
          storeId,
          storeName,
          storeSlug,
          storeWhatsapp,
          items: group.items,
          customerName,
          deliveryAddress,
          phone,
          city,
          itemsSubtotal,
          deliveryFee,
          totalAmount: storeTotal,
          paymentMethod: 'paiement_a_la_livraison' as const,
          orderStatus: 'en_attente' as const,
          notes,
          idempotencyKey,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        tx.set(doc(db, 'orders', orderId), orderDoc);
        subOrders.push(mapOrderDoc(orderDoc, orderId));

        // Seller notification
        const sellerNotifId = generateDocId('ntf');
        tx.set(doc(db, 'notifications', sellerNotifId), {
          notificationId: sellerNotifId,
          userId: sellerId,
          type: 'nouvelle_commande',
          title: clampStr(`Nouvelle commande ${orderNumber}`, 150),
          message: clampStr(
            `${customerName} a commandé pour ${storeTotal.toLocaleString('fr-FR')} FCFA dans ${storeName}.`,
            500,
          ),
          link: '/espace-vendeur',
          read: false,
          createdAt: nowIso,
        });
      }

      // Customer confirmation notification
      const buyerNotifId = generateDocId('ntf');
      tx.set(doc(db, 'notifications', buyerNotifId), {
        notificationId: buyerNotifId,
        userId: params.uid,
        type: 'confirmation_commande',
        title: clampStr(`Commande ${globalOrderNumber} enregistrée`, 150),
        message: clampStr(
          `Votre commande de ${totalAmount.toLocaleString('fr-FR')} FCFA (Paiement à la livraison) a été transmise.`,
          500,
        ),
        link: '/historique-commandes',
        read: false,
        createdAt: nowIso,
      });

      const globalOrder: GlobalOrder = {
        id: globalOrderNumber,
        globalOrderNumber,
        clientId: params.uid,
        subOrderIds: subOrders.map((s) => s.id),
        itemsSubtotal: totalItemsSubtotal,
        deliveryFee: totalDeliveryFee,
        totalAmount,
        customerName,
        customerPhone: phone,
        customerCity: city,
        deliveryAddress,
        paymentMethod: 'paiement_a_la_livraison',
        createdAt: nowIso,
      };

      return { globalOrder, subOrders };
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Stock insuffisant') ||
        err.message.includes('introuvable') ||
        err.message.includes('suspendue') ||
        err.message.includes('disponible'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, 'orders');
  }
}

export async function fetchCustomerOrders(uid: string): Promise<SubOrder[]> {
  try {
    const snap = await getDocs(query(collection(db, 'orders'), where('customerId', '==', uid)));
    return snap.docs
      .map((d) => mapOrderDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'orders');
  }
}

export async function fetchVendorOrders(uid: string): Promise<SubOrder[]> {
  try {
    const snap = await getDocs(query(collection(db, 'orders'), where('sellerId', '==', uid)));
    return snap.docs
      .map((d) => mapOrderDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'orders');
  }
}

export async function fetchOrderById(orderId: string): Promise<SubOrder> {
  const path = `orders/${orderId}`;
  try {
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (!snap.exists()) throw new Error('Commande introuvable.');
    return mapOrderDoc(snap.data(), snap.id);
  } catch (err) {
    if (err instanceof Error && err.message === 'Commande introuvable.') throw err;
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function cancelOrderTransaction(orderId: string): Promise<SubOrder> {
  const path = `orders/${orderId}`;
  const nowIso = new Date().toISOString();
  try {
    return await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error('Commande introuvable.');
      const orderData = orderSnap.data();
      if (orderData.orderStatus !== 'en_attente') {
        throw new Error('Seule une commande en attente peut être annulée par le client.');
      }

      const items = Array.isArray(orderData.items) ? (orderData.items as OrderItemSnapshot[]) : [];
      const prodSnaps = new Map<string, Record<string, unknown>>();
      for (const item of items) {
        const pSnap = await tx.get(doc(db, 'products', item.productId));
        if (pSnap.exists()) prodSnaps.set(item.productId, pSnap.data());
      }

      tx.update(orderRef, { orderStatus: 'annulee', updatedAt: nowIso });

      for (const item of items) {
        const pData = prodSnaps.get(item.productId);
        if (pData) {
          const newStock = Number(pData.stock || 0) + item.quantity;
          tx.update(doc(db, 'products', item.productId), {
            stock: newStock,
            status: pData.status === 'rupture' && newStock > 0 ? 'disponible' : pData.status,
            updatedAt: nowIso,
          });
        }
      }

      const notifId = generateDocId('ntf');
      tx.set(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        userId: String(orderData.sellerId),
        type: 'changement_statut',
        title: clampStr(`Commande ${orderData.orderNumber} annulée`, 150),
        message: clampStr(`Le client ${orderData.customerName} a annulé sa commande.`, 500),
        link: '/espace-vendeur',
        read: false,
        createdAt: nowIso,
      });

      return mapOrderDoc({ ...orderData, orderStatus: 'annulee', updatedAt: nowIso }, orderId);
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Seule une commande')) throw err;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateVendorOrderStatusDoc(
  orderId: string,
  nextStatus: OrderStatus,
): Promise<void> {
  const path = `orders/${orderId}`;
  const nowIso = new Date().toISOString();
  const statusLabels: Record<OrderStatus, string> = {
    en_attente: 'En attente',
    confirmee: 'Confirmée',
    en_preparation: 'En préparation',
    expediee: 'Expédiée',
    livree: 'Livrée',
    annulee: 'Annulée',
  };

  try {
    await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) throw new Error('Commande introuvable.');
      const orderData = orderSnap.data();

      if (orderData.orderStatus === 'livree' || orderData.orderStatus === 'annulee') {
        throw new Error('Une commande terminée ou annulée ne peut plus être modifiée.');
      }

      const items = Array.isArray(orderData.items) ? (orderData.items as OrderItemSnapshot[]) : [];
      const prodSnaps = new Map<string, Record<string, unknown>>();
      if (nextStatus === 'annulee') {
        for (const item of items) {
          const pSnap = await tx.get(doc(db, 'products', item.productId));
          if (pSnap.exists()) prodSnaps.set(item.productId, pSnap.data());
        }
      }

      tx.update(orderRef, { orderStatus: nextStatus, updatedAt: nowIso });

      if (nextStatus === 'annulee') {
        for (const item of items) {
          const pData = prodSnaps.get(item.productId);
          if (pData) {
            const newStock = Number(pData.stock || 0) + item.quantity;
            tx.update(doc(db, 'products', item.productId), {
              stock: newStock,
              status: pData.status === 'rupture' && newStock > 0 ? 'disponible' : pData.status,
              updatedAt: nowIso,
            });
          }
        }
      }

      const notifId = generateDocId('ntf');
      tx.set(doc(db, 'notifications', notifId), {
        notificationId: notifId,
        userId: String(orderData.customerId),
        type: 'changement_statut',
        title: clampStr(`Commande ${orderData.orderNumber} : ${statusLabels[nextStatus]}`, 150),
        message: clampStr(
          `La boutique ${orderData.storeName} a mis à jour votre commande (${statusLabels[nextStatus]}).`,
          500,
        ),
        link: `/commande/${orderId}`,
        read: false,
        createdAt: nowIso,
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('terminée')) throw err;
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

// ==================== VENDOR DASHBOARD AGGREGATION ====================
export async function fetchVendorDashboardData(uid: string): Promise<{
  shop: Shop | null;
  products: Product[];
  orders: SubOrder[];
  reviews: Review[];
  lives: LiveSession[];
  stats: {
    totalRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    deliveredOrders: number;
    visitorCount: number;
    productCount: number;
    availableProducts: number;
    outOfStockProducts: number;
  };
}> {
  const shop = await fetchMyStore(uid);
  if (!shop) {
    return {
      shop: null,
      products: [],
      orders: [],
      reviews: [],
      lives: [],
      stats: {
        totalRevenue: 0,
        totalOrders: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        deliveredOrders: 0,
        visitorCount: 0,
        productCount: 0,
        availableProducts: 0,
        outOfStockProducts: 0,
      },
    };
  }

  const [products, orders, allReviews, lives] = await Promise.all([
    fetchVendorProducts(uid),
    fetchVendorOrders(uid),
    fetchPublicReviews(),
    fetchVendorLives(uid),
  ]);

  const reviews = allReviews.filter((r) => r.shopId === shop.id);
  const deliveredOrdersList = orders.filter((o) => o.status === 'livree');
  // Chiffre d'affaires réel calculé uniquement sur les commandes livrées
  const totalRevenue = deliveredOrdersList.reduce((sum, o) => sum + o.subtotal, 0);
  const pendingOrders = orders.filter((o) => o.status === 'en_attente').length;
  const confirmedOrders = orders.filter((o) =>
    ['confirmee', 'en_preparation', 'expediee', 'livree'].includes(o.status),
  ).length;
  const availableProducts = products.filter((p) => p.status === 'disponible' && p.stock > 0).length;
  const outOfStockProducts = products.filter((p) => p.status === 'rupture' || p.stock === 0).length;

  return {
    shop,
    products,
    orders,
    reviews,
    lives,
    stats: {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrders,
      confirmedOrders,
      deliveredOrders: deliveredOrdersList.length,
      visitorCount: shop.visitorCount,
      productCount: products.length,
      availableProducts,
      outOfStockProducts,
    },
  };
}

// ==================== REVIEWS & REPORTS ====================
export async function fetchPublicReviews(): Promise<Review[]> {
  try {
    const snap = await getDocs(query(collection(db, 'reviews'), where('hidden', '==', false)));
    return snap.docs
      .map((d) => mapReviewDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'reviews');
  }
}

export async function createReviewDoc(params: {
  productId: string;
  storeId: string;
  user: User;
  rating: number;
  comment: string;
}): Promise<Review> {
  const comment = clampStr(params.comment, 1000);
  if (comment.length < 3) throw new Error('Veuillez écrire un avis d’au moins 3 caractères.');
  const rating = Math.min(5, Math.max(1, Math.round(params.rating)));
  const reviewId = generateDocId('rev');
  const nowIso = new Date().toISOString();

  const docData = {
    reviewId,
    productId: params.productId,
    storeId: params.storeId,
    userId: params.user.id,
    userName: clampStr(params.user.fullName, 100),
    rating,
    comment,
    vendorReply: null,
    hidden: false,
    createdAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'reviews', reviewId), docData);
    return mapReviewDoc(docData, reviewId);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewId}`);
  }
}

export async function replyToReviewDoc(reviewId: string, reply: string): Promise<void> {
  const clean = clampStr(reply, 800);
  if (!clean) throw new Error('Réponse requise.');
  try {
    await updateDoc(doc(db, 'reviews', reviewId), { vendorReply: clean });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reviews/${reviewId}`);
  }
}

export async function createReportDoc(params: {
  reporter: User;
  targetType: 'product' | 'shop' | 'review' | 'live' | 'live_comment';
  targetId: string;
  targetLabel: string;
  reason: string;
}): Promise<void> {
  const reason = clampStr(params.reason, 800);
  if (reason.length < 5) throw new Error('Le motif doit contenir au moins 5 caractères.');
  const reportId = generateDocId('rep');
  try {
    await setDoc(doc(db, 'reports', reportId), {
      reportId,
      reporterId: params.reporter.id,
      reporterName: clampStr(params.reporter.fullName, 100),
      targetType: params.targetType,
      targetId: clampStr(params.targetId, 128),
      targetLabel: clampStr(params.targetLabel, 150),
      reason,
      status: 'ouvert',
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
  }
}

// ==================== LIVE SHOPPING ====================
async function notifyFollowersAndVendorOnLive(params: {
  storeId: string;
  storeName: string;
  sellerId: string;
  liveTitle: string;
  liveSlug: string;
  event: 'scheduled' | 'started' | 'ended';
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const link = `/live/${params.liveSlug}`;

  const titleByEvent = {
    scheduled: `Nouveau live programmé · ${params.storeName}`,
    started: `${params.storeName} est EN DIRECT !`,
    ended: `Fin du live · ${params.storeName}`,
  }[params.event];

  const msgByEvent = {
    scheduled: `${params.storeName} a programmé le live « ${params.liveTitle} ».`,
    started: `Rejoignez maintenant la diffusion en direct « ${params.liveTitle} ».`,
    ended: `La session Live « ${params.liveTitle} » est maintenant terminée.`,
  }[params.event];

  // 1. Vendor personal confirmation notification
  const vendorNotifId = generateDocId('ntf');
  setDoc(doc(db, 'notifications', vendorNotifId), {
    notificationId: vendorNotifId,
    userId: params.sellerId,
    type: 'nouveau_live',
    title: titleByEvent.slice(0, 150),
    message: msgByEvent.slice(0, 500),
    link,
    read: false,
    createdAt: nowIso,
  }).catch(() => {});

  // 2. Notify shop followers via privacy-safe storeFollowers index (bounded)
  try {
    const followersSnap = await getDocs(
      query(
        collection(db, 'storeFollowers'),
        where('storeOwnerId', '==', params.sellerId),
        limit(250),
      ),
    );
    const followerIds = followersSnap.docs
      .map((d) => String(d.data().userId || ''))
      .filter((uid) => Boolean(uid) && uid !== params.sellerId);

    const uniqueFollowers = Array.from(new Set(followerIds)).slice(0, 200);
    if (uniqueFollowers.length === 0) return;

    const batch = writeBatch(db);
    for (const followerUid of uniqueFollowers) {
      const nId = generateDocId('ntf');
      batch.set(doc(db, 'notifications', nId), {
        notificationId: nId,
        userId: followerUid,
        type: 'nouveau_live',
        title: titleByEvent.slice(0, 150),
        message: msgByEvent.slice(0, 500),
        link,
        read: false,
        createdAt: nowIso,
      });
    }
    await batch.commit();
  } catch {
    // Non-fatal if follower notification batch cannot run
  }
}

export async function fetchPublicLives(): Promise<LiveSession[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'lives'), where('moderatedHidden', '==', false)),
    );
    return snap.docs
      .map((d) => mapLiveDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'lives');
  }
}

export async function fetchVendorLives(sellerId: string): Promise<LiveSession[]> {
  try {
    const snap = await getDocs(query(collection(db, 'lives'), where('sellerId', '==', sellerId)));
    return snap.docs
      .map((d) => mapLiveDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'lives');
  }
}

export async function fetchLiveRoomData(slug: string): Promise<{
  live: LiveSession;
  shop: Shop | null;
  products: Product[];
}> {
  let live: LiveSession | null = null;
  const allLives = await fetchPublicLives();
  live = allLives.find((l) => l.slug === slug || l.id === slug) || null;

  // Fallback direct lookup in case owner views a moderated/pending room by exact ID
  if (!live && /^[a-zA-Z0-9_-]{1,128}$/.test(slug)) {
    try {
      const directSnap = await getDoc(doc(db, 'lives', slug));
      if (directSnap.exists()) {
        live = mapLiveDoc(directSnap.data(), directSnap.id);
      }
    } catch {
      live = null;
    }
  }

  if (!live) throw new Error('Session Live introuvable.');

  let shop: Shop | null = null;
  try {
    const sSnap = await getDoc(doc(db, 'stores', live.shopId));
    if (sSnap.exists()) shop = mapStoreDoc(sSnap.data(), sSnap.id);
  } catch {
    shop = null;
  }

  // Load products belonging to this store (including disponible and rupture so viewers see stock state)
  const storeSnap = await getDocs(
    query(collection(db, 'products'), where('storeId', '==', live.shopId)),
  );
  const storeProducts = storeSnap.docs
    .map((d) => mapProductDoc(d.data(), d.id))
    .filter((p) => p.status === 'disponible' || p.status === 'rupture');

  const productById = new Map(storeProducts.map((p) => [p.id, p]));
  const orderedProducts: Product[] = [];
  for (const pid of live.productIds) {
    const found = productById.get(pid);
    if (found) orderedProducts.push(found);
  }

  // Keep featured product pinned first if set
  if (live.featuredProductId) {
    const idx = orderedProducts.findIndex((p) => p.id === live!.featuredProductId);
    if (idx > 0) {
      const [featured] = orderedProducts.splice(idx, 1);
      orderedProducts.unshift(featured);
    }
  }

  return { live, shop, products: orderedProducts };
}

export async function createLiveDoc(
  uid: string,
  shop: Shop,
  payload: {
    title: string;
    description: string;
    category?: string;
    coverUrl?: string;
    scheduledAt: string;
    youtubeUrl?: string;
    youtubeVideoId?: string;
    embedUrl?: string;
    initialStatus?: 'programme' | 'en_preparation';
    productIds: string[];
    featuredProductId?: string | null;
  },
): Promise<LiveSession> {
  const title = clampStr(payload.title, 150);
  if (title.length < 3) throw new Error('Titre du live requis (min. 3 caractères).');
  const liveId = generateDocId('live');
  const slug = `${slugifyText(title)}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 100);
  const nowIso = new Date().toISOString();

  const parsedYt = parseStrictYouTubeUrl(payload.youtubeUrl);
  const youtubeUrl = parsedYt?.youtubeUrl || clampStr(payload.youtubeUrl || '', 600);
  const youtubeVideoId = parsedYt?.videoId || clampStr(payload.youtubeVideoId || '', 20);
  const embedUrl = parsedYt?.embedUrl || clampStr(payload.embedUrl || '', 600);

  const productIds = payload.productIds.slice(0, 30);
  const featuredProductId =
    payload.featuredProductId && productIds.includes(payload.featuredProductId)
      ? payload.featuredProductId
      : productIds[0] || null;

  const docData = {
    liveId,
    slug,
    sellerId: uid,
    storeId: shop.id,
    storeName: clampStr(shop.name, 100),
    storeSlug: clampStr(shop.slug, 80),
    title,
    description: clampStr(payload.description, 1000),
    category: clampStr(payload.category || 'Autres produits', 80),
    coverImage:
      clampStr(payload.coverUrl || '', 1000) ||
      shop.coverUrl ||
      '/src/assets/images/live_shopping_studio_1794611253260.jpg',
    streamProvider: 'youtube' as const,
    streamUrl: youtubeUrl,
    youtubeUrl,
    youtubeVideoId,
    embedUrl,
    status: payload.initialStatus === 'en_preparation' ? 'en_preparation' : 'programme',
    scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt).toISOString() : nowIso,
    startedAt: null,
    endedAt: null,
    productIds,
    featuredProductId,
    moderatedHidden: false,
    createdAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'lives', liveId), docData);
    void notifyFollowersAndVendorOnLive({
      storeId: shop.id,
      storeName: shop.name,
      sellerId: uid,
      liveTitle: title,
      liveSlug: slug,
      event: 'scheduled',
    });
    return mapLiveDoc(docData, liveId);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `lives/${liveId}`);
  }
}

export async function updateLiveStatusDoc(
  liveId: string,
  status: LiveSession['status'],
): Promise<void> {
  const nowIso = new Date().toISOString();
  const updates: Record<string, unknown> = { status };
  if (status === 'en_direct') updates.startedAt = nowIso;
  if (status === 'termine' || status === 'annule') updates.endedAt = nowIso;

  try {
    const snap = await getDoc(doc(db, 'lives', liveId));
    if (!snap.exists()) throw new Error('Session Live introuvable.');
    const raw = snap.data();

    if (status === 'en_direct') {
      const hasValidYouTube =
        Boolean(parseStrictYouTubeUrl(String(raw.youtubeUrl || raw.streamUrl || ''))) ||
        (typeof raw.embedUrl === 'string' &&
          raw.embedUrl.startsWith('https://www.youtube.com/embed/'));
      if (!hasValidYouTube) {
        throw new Error(
          'Veuillez d’abord enregistrer un lien YouTube Live valide avant de confirmer le passage EN DIRECT.',
        );
      }
    }

    await updateDoc(doc(db, 'lives', liveId), updates);

    if (status === 'en_direct' || status === 'termine') {
      void notifyFollowersAndVendorOnLive({
        storeId: String(raw.storeId || ''),
        storeName: String(raw.storeName || ''),
        sellerId: String(raw.sellerId || ''),
        liveTitle: String(raw.title || ''),
        liveSlug: String(raw.slug || liveId),
        event: status === 'en_direct' ? 'started' : 'ended',
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('YouTube Live valide')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `lives/${liveId}`);
  }
}

export async function startLiveDoc(
  liveId: string,
  _streamType?: 'youtube' | 'camera' | 'external_url',
  _streamUrl?: string,
): Promise<void> {
  await updateLiveStatusDoc(liveId, 'en_direct');
}

export async function endLiveDoc(liveId: string): Promise<void> {
  await updateLiveStatusDoc(liveId, 'termine');
}

export async function updateLiveDetailsDoc(
  liveId: string,
  updates: {
    title?: string;
    description?: string;
    category?: string;
    coverUrl?: string;
    scheduledAt?: string;
    productIds?: string[];
    featuredProductId?: string | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (updates.title !== undefined) payload.title = clampStr(updates.title, 150);
  if (updates.description !== undefined) payload.description = clampStr(updates.description, 1000);
  if (updates.category !== undefined) payload.category = clampStr(updates.category, 80);
  if (updates.coverUrl !== undefined) payload.coverImage = clampStr(updates.coverUrl, 1000);
  if (updates.scheduledAt !== undefined) {
    payload.scheduledAt = new Date(updates.scheduledAt).toISOString();
  }
  if (updates.productIds !== undefined) {
    payload.productIds = updates.productIds.slice(0, 30);
  }
  if (updates.featuredProductId !== undefined) {
    payload.featuredProductId = updates.featuredProductId;
  }

  try {
    await updateDoc(doc(db, 'lives', liveId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `lives/${liveId}`);
  }
}

export async function deleteLiveDoc(liveId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'lives', liveId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `lives/${liveId}`);
  }
}

export function subscribeLiveComments(
  liveId: string,
  onData: (comments: LiveComment[]) => void,
): Unsubscribe {
  const path = `lives/${liveId}/comments`;
  const q = query(
    collection(db, 'lives', liveId, 'comments'),
    where('liveId', '==', liveId),
    limit(120),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: LiveComment[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.commentId || d.id),
            liveId: String(data.liveId || liveId),
            userId: String(data.userId || ''),
            userName: String(data.userName || ''),
            userAvatar: typeof data.userAvatar === 'string' ? data.userAvatar : '',
            text: String(data.text || ''),
            isQuestion: Boolean(data.isQuestion),
            reactionType:
              (data.reactionType as LiveComment['reactionType']) ||
              (data.isQuestion ? 'question' : 'comment'),
            hidden: Boolean(data.hidden),
            createdAt: String(data.createdAt || ''),
          };
        })
        .filter((c) => !c.hidden)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, path);
    },
  );
}

export async function fetchLiveCommentsList(liveId: string): Promise<LiveComment[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'lives', liveId, 'comments'), where('liveId', '==', liveId), limit(150)),
    );
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: String(data.commentId || d.id),
          liveId: String(data.liveId || liveId),
          userId: String(data.userId || ''),
          userName: String(data.userName || ''),
          userAvatar: typeof data.userAvatar === 'string' ? data.userAvatar : '',
          text: String(data.text || ''),
          isQuestion: Boolean(data.isQuestion),
          reactionType:
            (data.reactionType as LiveComment['reactionType']) ||
            (data.isQuestion ? 'question' : 'comment'),
          hidden: Boolean(data.hidden),
          createdAt: String(data.createdAt || ''),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `lives/${liveId}/comments`);
  }
}

export async function postLiveCommentDoc(
  liveId: string,
  user: User,
  text: string,
  reactionType?: 'comment' | 'question' | 'reaction',
): Promise<void> {
  const clean = clampStr(text, 500);
  if (!clean) return;
  const commentId = generateDocId('cmt');
  const isQuestion = reactionType === 'question' || clean.includes('?');
  try {
    await setDoc(doc(db, 'lives', liveId, 'comments', commentId), {
      commentId,
      liveId,
      userId: user.id,
      userName: clampStr(user.fullName, 100),
      userAvatar: clampStr(user.avatarUrl || '', 1000),
      text: clean,
      isQuestion,
      reactionType: reactionType || (isQuestion ? 'question' : 'comment'),
      hidden: false,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `lives/${liveId}/comments/${commentId}`);
  }
}

// ==================== CONVERSATIONS & MESSAGES ====================
export function subscribeConversations(
  uid: string,
  onData: (threads: MessageThread[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const threads: MessageThread[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.conversationId || d.id),
            clientId: String(data.clientId || ''),
            clientName: String(data.clientName || 'Client'),
            vendorId: String(data.sellerId || ''),
            shopId: String(data.storeId || ''),
            shopName: String(data.storeName || 'Boutique'),
            lastMessage: String(data.lastMessage || ''),
            lastMessageAt: String(data.updatedAt || ''),
          };
        })
        .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
      onData(threads);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'conversations');
    },
  );
}

export function subscribeUserMessages(
  uid: string,
  onData: (messages: DirectMessage[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'messages'), where('participants', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      const msgs: DirectMessage[] = snap.docs
        .map((d) => {
          const data = d.data();
          const participants = Array.isArray(data.participants) ? data.participants.map(String) : [];
          const recipientId = participants.find((p) => p !== data.senderId) || String(data.senderId);
          return {
            id: String(data.messageId || d.id),
            threadId: String(data.conversationId || ''),
            senderId: String(data.senderId || ''),
            senderName: String(data.senderName || ''),
            recipientId,
            productId: typeof data.productId === 'string' ? data.productId : undefined,
            text: String(data.text || ''),
            read: Boolean(data.read),
            createdAt: String(data.createdAt || ''),
          };
        })
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onData(msgs);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'messages');
    },
  );
}

export async function sendDirectMessageDoc(params: {
  sender: User;
  text: string;
  threadId?: string;
  shop?: Shop;
  productId?: string;
}): Promise<string> {
  const clean = clampStr(params.text, 1200);
  if (!clean) throw new Error('Le message ne peut pas être vide.');
  const nowIso = new Date().toISOString();

  let conversationId = params.threadId || '';
  let participants: string[] = [];

  if (!conversationId) {
    if (!params.shop) throw new Error('Boutique destinataire requise.');
    if (params.shop.ownerId === params.sender.id) {
      throw new Error('Vous ne pouvez pas démarrer une conversation avec votre propre boutique.');
    }
    conversationId = `conv_${params.sender.id}_${params.shop.id}`.slice(0, 128);
    participants = [params.sender.id, params.shop.ownerId];
    const convRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef).catch((err) => {
      // If doc doesn't exist, getDoc might hit permission-denied because existing() is null in rule
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        return null;
      }
      handleFirestoreError(err, OperationType.GET, `conversations/${conversationId}`);
    });

    if (!convSnap || !convSnap.exists()) {
      try {
        await setDoc(convRef, {
          conversationId,
          participants,
          clientId: params.sender.id,
          clientName: clampStr(params.sender.fullName, 100),
          sellerId: params.shop.ownerId,
          storeId: params.shop.id,
          storeName: clampStr(params.shop.name, 100),
          lastMessage: clampStr(clean, 1000),
          updatedAt: nowIso,
          createdAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `conversations/${conversationId}`);
      }
    } else {
      participants = Array.isArray(convSnap.data().participants)
        ? convSnap.data().participants.map(String)
        : participants;
      try {
        await updateDoc(convRef, {
          lastMessage: clampStr(clean, 1000),
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`);
      }
    }
  } else {
    const convRef = doc(db, 'conversations', conversationId);
    let convSnap;
    try {
      convSnap = await getDoc(convRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `conversations/${conversationId}`);
    }
    if (!convSnap.exists()) throw new Error('Conversation introuvable.');
    const convData = convSnap.data();
    participants = Array.isArray(convData.participants) ? convData.participants.map(String) : [];
    try {
      await updateDoc(convRef, {
        lastMessage: clampStr(clean, 1000),
        updatedAt: nowIso,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `conversations/${conversationId}`);
    }
  }

  const messageId = generateDocId('msg');
  try {
    await setDoc(doc(db, 'messages', messageId), {
      messageId,
      conversationId,
      participants,
      senderId: params.sender.id,
      senderName: clampStr(params.sender.fullName, 100),
      productId: params.productId ? clampStr(params.productId, 128) : '',
      text: clean,
      read: false,
      createdAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `messages/${messageId}`);
  }

  // Send notification to other participant (best effort)
  const recipientId = participants.find((p) => p !== params.sender.id);
  if (recipientId) {
    const notifId = generateDocId('ntf');
    setDoc(doc(db, 'notifications', notifId), {
      notificationId: notifId,
      userId: recipientId,
      type: 'nouveau_message',
      title: clampStr(`Nouveau message de ${params.sender.fullName}`, 150),
      message: clampStr(clean, 500),
      link: '/messagerie',
      read: false,
      createdAt: nowIso,
    }).catch(() => {});
  }

  return conversationId;
}

// ==================== NOTIFICATIONS ====================
export function subscribeNotifications(
  uid: string,
  onData: (items: NotificationItem[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapNotificationDoc(d.data(), d.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    },
  );
}

export async function markAllNotificationsReadDocs(items: NotificationItem[]): Promise<void> {
  const unread = items.filter((n) => !n.read);
  if (unread.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'notifications');
  }
}

// ==================== CATEGORIES ====================
export async function fetchCategories(): Promise<CategoryItem[]> {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) return DEFAULT_CATEGORIES;
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.id || d.id),
        name: String(data.name || ''),
        slug: String(data.slug || ''),
        description: String(data.description || ''),
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'categories');
  }
}

// ==================== ADMIN CONSOLE ====================
export async function fetchAdminOverviewData(): Promise<{
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
}> {
  try {
    const [uSnap, sSnap, pSnap, oSnap, rSnap, lSnap, repSnap, cSnap] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'stores')),
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'orders')),
      getDocs(collection(db, 'reviews')),
      getDocs(collection(db, 'lives')),
      getDocs(collection(db, 'reports')),
      getDocs(collection(db, 'categories')),
    ]);

    const users: User[] = uSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: String(data.uid || d.id),
        fullName: String(data.fullName || ''),
        email: String(data.email || ''),
        phone: String(data.phone || ''),
        city: String(data.city || ''),
        avatarUrl: String(data.photoURL || ''),
        roles: Array.isArray(data.roles) ? (data.roles as UserRole[]) : ['client'],
        suspended: Boolean(data.suspended),
        favorites: [],
        followedShopIds: Array.isArray(data.followedStoreIds) ? data.followedStoreIds.map(String) : [],
        createdAt: String(data.createdAt || ''),
      };
    });

    const shops = sSnap.docs.map((d) => mapStoreDoc(d.data(), d.id));
    const products = pSnap.docs.map((d) => mapProductDoc(d.data(), d.id));
    const orders = oSnap.docs
      .map((d) => mapOrderDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const reviews = rSnap.docs.map((d) => mapReviewDoc(d.data(), d.id));
    const lives = lSnap.docs.map((d) => mapLiveDoc(d.data(), d.id));
    const reports = repSnap.docs
      .map((d) => mapReportDoc(d.data(), d.id))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const categories = cSnap.empty
      ? DEFAULT_CATEGORIES
      : cSnap.docs.map((d) => ({
          id: String(d.data().id || d.id),
          name: String(d.data().name || ''),
          slug: String(d.data().slug || ''),
          description: String(d.data().description || ''),
        }));

    return {
      stats: {
        usersCount: users.length,
        vendorsCount: users.filter((u) => u.roles.includes('vendor')).length,
        shopsCount: shops.length,
        pendingShopsCount: shops.filter((s) => s.verifiedStatus === 'pending').length,
        productsCount: products.length,
        ordersCount: orders.length,
        totalRevenue: orders
          .filter((o) => o.status !== 'annulee')
          .reduce((acc, o) => acc + o.subtotal, 0),
        openReportsCount: reports.filter((r) => r.status === 'ouvert').length,
      },
      users,
      shops,
      products,
      orders,
      reviews,
      lives,
      reports,
      categories,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'admin/overview');
  }
}

export async function adminUpdateStoreStatus(storeId: string, verifiedStatus: ShopStatus): Promise<void> {
  try {
    const updates: Record<string, unknown> = { verificationStatus: verifiedStatus };
    if (verifiedStatus === 'verified') {
      updates.certificationRequested = false;
    }
    await updateDoc(doc(db, 'stores', storeId), updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `stores/${storeId}`);
  }
}

export async function adminToggleUserSuspend(userId: string, suspended: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      suspended,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function adminUpdateProductStatus(productId: string, status: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'products', productId), {
      status,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
  }
}

export async function adminDeleteProduct(productId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

export async function adminUpdateReportStatus(
  reportId: string,
  status: 'resolu' | 'rejete',
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reports', reportId), { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
  }
}

export async function adminToggleReviewHide(reviewId: string, hidden: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'reviews', reviewId), { hidden });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reviews/${reviewId}`);
  }
}

export async function adminToggleLiveModeration(liveId: string, hidden: boolean): Promise<void> {
  try {
    await updateDoc(doc(db, 'lives', liveId), { moderatedHidden: hidden });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `lives/${liveId}`);
  }
}

export async function adminDeleteLive(liveId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'lives', liveId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `lives/${liveId}`);
  }
}

export async function adminHideLiveComment(
  liveId: string,
  commentId: string,
  hidden: boolean,
): Promise<void> {
  try {
    await updateDoc(doc(db, 'lives', liveId, 'comments', commentId), { hidden });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `lives/${liveId}/comments/${commentId}`);
  }
}

export async function adminDeleteLiveComment(liveId: string, commentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'lives', liveId, 'comments', commentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `lives/${liveId}/comments/${commentId}`);
  }
}

export async function adminCreateCategory(name: string, description: string): Promise<void> {
  const cleanName = clampStr(name, 80);
  if (cleanName.length < 2) throw new Error('Nom de catégorie requis.');
  const id = generateDocId('cat');
  try {
    await setDoc(doc(db, 'categories', id), {
      id,
      name: cleanName,
      slug: slugifyText(cleanName),
      description: clampStr(description, 300),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `categories/${id}`);
  }
}

export async function adminDeleteCategory(categoryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `categories/${categoryId}`);
  }
}
