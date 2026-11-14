import type { LiveStatus, OrderStatus, ProductStatus, ShopStatus } from './types';

export const OFFICIAL_WHATSAPP_RAW = '22792974792';
export const OFFICIAL_WHATSAPP_DISPLAY = '+227 92 97 47 92';
export const OFFICIAL_EMAIL = 'support@techstylemarket.ne';

export const NIGER_CITIES = [
  'Niamey',
  'Maradi',
  'Zinder',
  'Tahoua',
  'Agadez',
  'Dosso',
  'Diffa',
  'Tillabéri',
  'International',
] as const;

export const DEFAULT_CATEGORIES = [
  {
    id: 'cat-telephones',
    name: 'Téléphones et accessoires',
    slug: 'telephones-et-accessoires',
    description: 'Smartphones, chargeurs rapides, coques et écouteurs sans fil.',
  },
  {
    id: 'cat-informatique',
    name: 'Informatique et technologie',
    slug: 'informatique-et-technologie',
    description: 'Ordinateurs portables, tablettes, stockage et périphériques.',
  },
  {
    id: 'cat-mode',
    name: 'Mode et vêtements',
    slug: 'mode-et-vetements',
    description: 'Prêt-à-porter contemporain, tenues traditionnelles et textiles.',
  },
  {
    id: 'cat-chaussures',
    name: 'Chaussures et sacs',
    slug: 'chaussures-et-sacs',
    description: 'Maroquinerie, sacs de voyage, baskets et chaussures habillées.',
  },
  {
    id: 'cat-beaute',
    name: 'Beauté et cosmétiques',
    slug: 'beaute-et-cosmetiques',
    description: 'Soins du visage, parfums, huiles botaniques et cosmétiques.',
  },
  {
    id: 'cat-maison',
    name: 'Maison et décoration',
    slug: 'maison-et-decoration',
    description: 'Luminaires, mobilier léger et arts de la table.',
  },
  {
    id: 'cat-electromenager',
    name: 'Électroménager',
    slug: 'electromenager',
    description: 'Machines à café, réfrigération, ventilation et cuisine.',
  },
  {
    id: 'cat-alimentation',
    name: 'Alimentation',
    slug: 'alimentation',
    description: 'Épicerie fine, produits locaux du Sahel et boissons.',
  },
  {
    id: 'cat-accessoires',
    name: 'Accessoires',
    slug: 'accessoires',
    description: 'Montres, lunettes, ceintures et objets du quotidien.',
  },
  {
    id: 'cat-autres',
    name: 'Autres produits',
    slug: 'autres-produits',
    description: 'Articles divers, papeterie et équipements spécialisés.',
  },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'en_attente',
  'confirmee',
  'en_preparation',
  'expediee',
  'livree',
];

export const SHOP_STATUS_LABELS: Record<ShopStatus, string> = {
  unverified: 'Non vérifiée',
  pending: 'En attente de validation',
  verified: 'Vérifiée & Certifiée',
  suspended: 'Suspendue',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  disponible: 'Publié',
  rupture: 'Rupture de stock',
  brouillon: 'Brouillon',
  masque: 'Archivé',
};

export const PRODUCT_CONDITIONS = [
  'Neuf',
  'Comme neuf',
  'Reconditionné',
  'Occasion — Bon état',
] as const;

export const LIVE_STATUS_LABELS: Record<LiveStatus, string> = {
  programme: 'Programmé',
  en_preparation: 'En préparation',
  en_direct: 'En direct',
  termine: 'Terminé',
  annule: 'Annulé',
};

export const LIVE_CATEGORIES = [
  'Téléphones et accessoires',
  'Informatique et technologie',
  'Mode et vêtements',
  'Chaussures et sacs',
  'Beauté et cosmétiques',
  'Maison et décoration',
  'Électroménager',
  'Alimentation',
  'Promotions Flash',
  'Autres produits',
] as const;

export function formatFCFA(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${safe.toLocaleString('fr-FR')} FCFA`;
}

export function normalizeWhatsappNumber(phone?: string | null): string {
  if (!phone) return OFFICIAL_WHATSAPP_RAW;
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits || digits.length < 8) return OFFICIAL_WHATSAPP_RAW;
  if (digits.length === 8) return `227${digits}`;
  return digits;
}

export function buildWhatsappOrderUrl(params: {
  whatsappNumber?: string | null;
  productName: string;
  price: number;
  reference: string;
  productUrl: string;
  quantity?: number;
}): { url: string; usedFallback: boolean; displayNumber: string } {
  const cleaned = normalizeWhatsappNumber(params.whatsappNumber);
  const usedFallback =
    !params.whatsappNumber || cleaned === OFFICIAL_WHATSAPP_RAW && !params.whatsappNumber.includes('92974792');
  const qtyText = params.quantity && params.quantity > 1 ? ` (Quantité : ${params.quantity})` : '';
  const message = [
    `Bonjour, je souhaite commander sur TECH STYLE MARKET :`,
    `• Produit : ${params.productName}${qtyText}`,
    `• Prix : ${formatFCFA(params.price)}`,
    `• Référence : ${params.reference}`,
    `• Lien : ${params.productUrl}`,
  ].join('\n');
  return {
    url: `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`,
    usedFallback,
    displayNumber: usedFallback ? OFFICIAL_WHATSAPP_DISPLAY : `+${cleaned}`,
  };
}
