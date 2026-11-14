export type UserRole = 'client' | 'vendor' | 'admin';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  avatarUrl: string;
  roles: UserRole[];
  suspended: boolean;
  favorites: string[];
  followedShopIds: string[];
  cart?: CartItem[];
  createdAt: string;
}

export type ShopStatus = 'unverified' | 'pending' | 'verified' | 'suspended';

export interface Shop {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  logoUrl: string;
  coverUrl: string;
  description: string;
  city: string;
  contactInfo: string;
  whatsappNumber: string;
  categories?: string[];
  acceptedVendorTerms?: boolean;
  verifiedStatus: ShopStatus;
  certificationRequested: boolean;
  deliveryFee?: number;
  visitorCount: number;
  createdAt: string;
}

export type ProductStatus = 'disponible' | 'rupture' | 'brouillon' | 'masque';

export interface ProductImageMeta {
  fileId: string;
  publicId?: string;
  fileName?: string;
  ownerId?: string;
  url: string;
  storagePath?: string;
  isPrimary: boolean;
  order: number;
  uploadedAt: string;
}

export interface Product {
  id: string;
  reference: string;
  shopId: string;
  vendorId: string;
  name: string;
  description: string;
  price: number;
  promoPrice?: number | null;
  images: string[];
  productImages?: ProductImageMeta[];
  category: string;
  stock: number;
  status: ProductStatus;
  city: string;
  condition?: string;
  additionalInfo?: string;
  salesCount: number;
  featured?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductWithShop extends Product {
  shop?: Shop;
}

export interface CartItem {
  productId: string;
  quantity: number;
}

export type OrderStatus =
  | 'en_attente'
  | 'confirmee'
  | 'en_preparation'
  | 'expediee'
  | 'livree'
  | 'annulee';

export interface OrderItemSnapshot {
  productId: string;
  reference: string;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string;
  lineTotal: number;
}

export interface SubOrder {
  id: string;
  orderNumber: string;
  globalOrderId: string;
  globalOrderNumber: string;
  clientId: string;
  vendorId: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  shopWhatsapp: string;
  items: OrderItemSnapshot[];
  itemsSubtotal?: number;
  deliveryFee?: number;
  subtotal: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  deliveryAddress: string;
  paymentMethod: 'paiement_a_la_livraison';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalOrder {
  id: string;
  globalOrderNumber: string;
  clientId: string;
  subOrderIds: string[];
  itemsSubtotal?: number;
  deliveryFee?: number;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  deliveryAddress: string;
  paymentMethod: 'paiement_a_la_livraison';
  createdAt: string;
}

export type LiveStatus = 'programme' | 'en_preparation' | 'en_direct' | 'termine' | 'annule';

export interface LiveSession {
  id: string;
  slug: string;
  shopId: string;
  vendorId: string;
  shopName: string;
  shopSlug: string;
  title: string;
  description: string;
  category: string;
  coverUrl: string;
  status: LiveStatus;
  streamType: 'youtube' | 'camera' | 'external_url';
  streamUrl: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  embedUrl: string;
  scheduledAt: string;
  startedAt?: string | null;
  endedAt?: string | null;
  productIds: string[];
  featuredProductId?: string | null;
  moderatedHidden?: boolean;
  createdAt: string;
}

export interface LiveComment {
  id: string;
  liveId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  isQuestion: boolean;
  reactionType?: 'comment' | 'question' | 'reaction';
  hidden?: boolean;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  shopId?: string;
  productId?: string;
  text: string;
  read: boolean;
  createdAt: string;
}

export interface MessageThread {
  id: string;
  clientId: string;
  clientName: string;
  vendorId: string;
  shopId: string;
  shopName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount?: number;
}

export type NotificationType =
  | 'nouvelle_commande'
  | 'confirmation_commande'
  | 'changement_statut'
  | 'nouveau_message'
  | 'nouveau_live'
  | 'systeme';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  shopId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  vendorReply?: string | null;
  hidden?: boolean;
  createdAt: string;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: 'product' | 'shop' | 'review' | 'live' | 'live_comment';
  targetId: string;
  targetLabel: string;
  reason: string;
  status: 'ouvert' | 'resolu' | 'rejete';
  createdAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description: string;
}
