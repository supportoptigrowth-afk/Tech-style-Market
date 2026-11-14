import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_CATEGORIES } from '../src/constants.ts';
import type {
  CategoryItem,
  DirectMessage,
  GlobalOrder,
  LiveComment,
  LiveSession,
  MessageThread,
  NotificationItem,
  Product,
  ReportItem,
  Review,
  Shop,
  SubOrder,
  User,
} from '../src/types.ts';
import { hashPassword } from './security.ts';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface PasswordResetToken {
  token: string;
  userId: string;
  email: string;
  expiresAt: number;
}

export interface DatabaseState {
  users: StoredUser[];
  shops: Shop[];
  products: Product[];
  globalOrders: GlobalOrder[];
  subOrders: SubOrder[];
  lives: LiveSession[];
  liveComments: LiveComment[];
  threads: MessageThread[];
  messages: DirectMessage[];
  notifications: NotificationItem[];
  reviews: Review[];
  reports: ReportItem[];
  categories: CategoryItem[];
  resetTokens: PasswordResetToken[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'marketplace.json');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function buildInitialState(): DatabaseState {
  const now = new Date().toISOString();
  const adminId = 'usr_admin_tsm';
  const vendor1Id = 'usr_vendor_niamey_tech';
  const vendor2Id = 'usr_vendor_sahel_style';
  const vendor3Id = 'usr_vendor_maradi_maison';
  const demoClientId = 'usr_client_demo';

  const defaultPassHash = hashPassword('TsmMarket2026!');

  const users: StoredUser[] = [
    {
      id: adminId,
      fullName: 'Administrateur TSM',
      email: 'admin@techstylemarket.ne',
      phone: '+227 92 97 47 92',
      city: 'Niamey',
      avatarUrl: '',
      roles: ['admin', 'client'],
      suspended: false,
      favorites: [],
      followedShopIds: [],
      passwordHash: defaultPassHash,
      createdAt: now,
    },
    {
      id: 'usr_admin_owner',
      fullName: 'Direction Tech Style Market',
      email: 'support.optigrowth@gmail.com',
      phone: '+227 92 97 47 92',
      city: 'Niamey',
      avatarUrl: '',
      roles: ['admin', 'client', 'vendor'],
      suspended: false,
      favorites: [],
      followedShopIds: [],
      passwordHash: defaultPassHash,
      createdAt: now,
    },
    {
      id: vendor1Id,
      fullName: 'Ibrahim Moussa',
      email: 'ibrahim@niameytech.ne',
      phone: '+227 96 42 18 10',
      city: 'Niamey',
      avatarUrl: '',
      roles: ['client', 'vendor'],
      suspended: false,
      favorites: [],
      followedShopIds: [],
      passwordHash: defaultPassHash,
      createdAt: now,
    },
    {
      id: vendor2Id,
      fullName: 'Aïcha Abdou',
      email: 'aicha@atelier-sahel.ne',
      phone: '+227 90 55 31 20',
      city: 'Niamey',
      avatarUrl: '',
      roles: ['client', 'vendor'],
      suspended: false,
      favorites: [],
      followedShopIds: [],
      passwordHash: defaultPassHash,
      createdAt: now,
    },
    {
      id: vendor3Id,
      fullName: 'Oumarou Sani',
      email: 'oumarou@maradimaison.ne',
      phone: '+227 98 11 44 09',
      city: 'Maradi',
      avatarUrl: '',
      roles: ['client', 'vendor'],
      suspended: false,
      favorites: [],
      followedShopIds: [],
      passwordHash: defaultPassHash,
      createdAt: now,
    },
    {
      id: demoClientId,
      fullName: 'Mariama Issa',
      email: 'client@techstylemarket.ne',
      phone: '+227 91 22 33 44',
      city: 'Niamey',
      avatarUrl: '',
      roles: ['client'],
      suspended: false,
      favorites: ['prod_phone_01', 'prod_sac_01'],
      followedShopIds: ['shop_niamey_tech'],
      passwordHash: defaultPassHash,
      createdAt: now,
    },
  ];

  const shops: Shop[] = [
    {
      id: 'shop_niamey_tech',
      ownerId: vendor1Id,
      name: 'Niamey Tech Hub',
      slug: 'niamey-tech-hub',
      logoUrl: '/src/assets/images/prod_smartphone_flagship_1794611251580.jpg',
      coverUrl: '/src/assets/images/hero_tech_market_1794611250879.jpg',
      description:
        'Spécialiste des smartphones neufs, ordinateurs portables professionnels et accessoires certifiés avec garantie locale à Niamey.',
      city: 'Niamey',
      contactInfo: 'Quartier Plateau, Avenue de la République, Niamey',
      whatsappNumber: '+227 96 42 18 10',
      verifiedStatus: 'verified',
      certificationRequested: false,
      visitorCount: 0,
      createdAt: now,
    },
    {
      id: 'shop_atelier_sahel',
      ownerId: vendor2Id,
      name: 'Atelier Sahel & Cuir',
      slug: 'atelier-sahel-cuir',
      logoUrl: '/src/assets/images/prod_fashion_accessories_1794611251665.jpg',
      coverUrl: '/src/assets/images/prod_fashion_accessories_1794611251665.jpg',
      description:
        'Maroquinerie artisanale, prêt-à-porter urbain et soins botaniques naturels fabriqués et sélectionnés avec soin au Niger.',
      city: 'Niamey',
      contactInfo: 'Wadata, Rue du Commerce, Niamey',
      whatsappNumber: '+227 90 55 31 20',
      verifiedStatus: 'verified',
      certificationRequested: false,
      visitorCount: 0,
      createdAt: now,
    },
    {
      id: 'shop_maradi_confort',
      ownerId: vendor3Id,
      name: 'Maradi Équipement & Maison',
      slug: 'maradi-equipement-maison',
      logoUrl: '/src/assets/images/prod_home_appliances_1794611253091.jpg',
      coverUrl: '/src/assets/images/prod_home_appliances_1794611253091.jpg',
      description:
        'Électroménager compact, machines à café et articles de décoration durable pour la maison et le bureau à Maradi et partout au Niger.',
      city: 'Maradi',
      contactInfo: 'Grand Marché de Maradi, Stand B14',
      whatsappNumber: '+227 98 11 44 09',
      verifiedStatus: 'verified',
      certificationRequested: false,
      visitorCount: 0,
      createdAt: now,
    },
  ];

  const products: Product[] = [
    {
      id: 'prod_phone_01',
      reference: 'TSM-104201',
      shopId: 'shop_niamey_tech',
      vendorId: vendor1Id,
      name: 'Smartphone Titanium Pro 256 Go + Écouteurs Sans Fil',
      description:
        'Châssis en titane brossé, écran OLED 120 Hz, double SIM compatible 4G/5G Niger, livré avec boîtier d’écouteurs sans fil à réduction de bruit active et garantie boutique 12 mois.',
      price: 485000,
      promoPrice: 449000,
      images: [
        '/src/assets/images/prod_smartphone_flagship_1794611251580.jpg',
        '/src/assets/images/hero_tech_market_1794611250879.jpg',
      ],
      category: 'Téléphones et accessoires',
      stock: 14,
      status: 'disponible',
      city: 'Niamey',
      salesCount: 0,
      featured: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_laptop_01',
      reference: 'TSM-104202',
      shopId: 'shop_niamey_tech',
      vendorId: vendor1Id,
      name: 'Ultrabook Ultra 14" — 16 Go RAM / SSD 512 Go',
      description:
        'Ordinateur portable fin en aluminium brossé, processeur dernière génération, autonomie 12 heures, clavier rétroéclairé AZERTY français et chargeur USB-C rapide inclus.',
      price: 560000,
      promoPrice: null,
      images: ['/src/assets/images/hero_tech_market_1794611250879.jpg'],
      category: 'Informatique et technologie',
      stock: 8,
      status: 'disponible',
      city: 'Niamey',
      salesCount: 0,
      featured: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_sac_01',
      reference: 'TSM-205101',
      shopId: 'shop_atelier_sahel',
      vendorId: vendor2Id,
      name: 'Sac Besace en Cuir Pleine Fleur Cognac',
      description:
        'Cuir tanné de haute qualité, coutures renforcées à la main, boucle en laiton brossé et bandoulière réglable. Idéal pour un usage professionnel ou quotidien.',
      price: 42500,
      promoPrice: 36000,
      images: ['/src/assets/images/prod_fashion_accessories_1794611251665.jpg'],
      category: 'Chaussures et sacs',
      stock: 19,
      status: 'disponible',
      city: 'Niamey',
      salesCount: 0,
      featured: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_mode_01',
      reference: 'TSM-205102',
      shopId: 'shop_atelier_sahel',
      vendorId: vendor2Id,
      name: 'Surchemise en Lin Naturel Coupe Droite',
      description:
        'Tissu en lin respirant parfaitement adapté au climat sahélien, boutons en corne véritable et finitions tailleur soignées.',
      price: 28000,
      promoPrice: null,
      images: ['/src/assets/images/prod_fashion_accessories_1794611251665.jpg'],
      category: 'Mode et vêtements',
      stock: 25,
      status: 'disponible',
      city: 'Niamey',
      salesCount: 0,
      featured: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_beaute_01',
      reference: 'TSM-205103',
      shopId: 'shop_atelier_sahel',
      vendorId: vendor2Id,
      name: 'Coffret Soin Botanique — Sérum Éclat & Crème Hydratante',
      description:
        'Duo de soins visage formulés à base d’extraits végétaux, huile de moringa et beurre de karité pur. Flacon verre ambré 50 ml et pot céramique 50 ml.',
      price: 24500,
      promoPrice: 19500,
      images: ['/src/assets/images/prod_beauty_cosmetics_1794611251956.jpg'],
      category: 'Beauté et cosmétiques',
      stock: 30,
      status: 'disponible',
      city: 'Niamey',
      salesCount: 0,
      featured: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_electro_01',
      reference: 'TSM-308901',
      shopId: 'shop_maradi_confort',
      vendorId: vendor3Id,
      name: 'Machine à Expresso Compacte Inox & Noir Mat',
      description:
        'Pression 15 bars, buse vapeur intégrée pour cappuccino, réservoir amovible 1,2 L et double tasse incluse. Livraison assurée à Maradi, Zinder et Niamey.',
      price: 135000,
      promoPrice: 118000,
      images: ['/src/assets/images/prod_home_appliances_1794611253091.jpg'],
      category: 'Électroménager',
      stock: 9,
      status: 'disponible',
      city: 'Maradi',
      salesCount: 0,
      featured: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_audio_01',
      reference: 'TSM-104203',
      shopId: 'shop_niamey_tech',
      vendorId: vendor1Id,
      name: 'Casque Studio Bluetooth Réduction de Bruit',
      description:
        'Transducteurs haute fidélité 40 mm, arceau métallique ajustable, autonomie 35 heures et câble audio USB-C fourni.',
      price: 68000,
      promoPrice: null,
      images: ['/src/assets/images/hero_tech_market_1794611250879.jpg'],
      category: 'Accessoires',
      stock: 16,
      status: 'disponible',
      city: 'Niamey',
      salesCount: 0,
      featured: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prod_maison_01',
      reference: 'TSM-308902',
      shopId: 'shop_maradi_confort',
      vendorId: vendor3Id,
      name: 'Service Tasses Grès Artisanal & Plateau Chêne',
      description:
        'Ensemble de 2 tasses en céramique mate avec sous-tasse en bois massif traité, conçu pour la table contemporaine.',
      price: 16500,
      promoPrice: null,
      images: ['/src/assets/images/prod_home_appliances_1794611253091.jpg'],
      category: 'Maison et décoration',
      stock: 22,
      status: 'disponible',
      city: 'Maradi',
      salesCount: 0,
      featured: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const lives: LiveSession[] = [
    {
      id: 'live_niamey_tech_01',
      slug: 'presentation-nouveautes-tech-niamey',
      shopId: 'shop_niamey_tech',
      vendorId: vendor1Id,
      shopName: 'Niamey Tech Hub',
      shopSlug: 'niamey-tech-hub',
      title: 'Démonstration en direct : Nouveaux Smartphones & Ultrabooks',
      description:
        'Posez vos questions techniques en direct, comparez les modèles et commandez avec livraison express à Niamey et dans tout le Niger.',
      category: 'Téléphones et accessoires',
      coverUrl: '/src/assets/images/live_shopping_studio_1794611253260.jpg',
      status: 'programme',
      streamType: 'youtube',
      streamUrl: '',
      youtubeUrl: '',
      youtubeVideoId: '',
      embedUrl: '',
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      startedAt: null,
      endedAt: null,
      productIds: ['prod_phone_01', 'prod_laptop_01', 'prod_audio_01'],
      featuredProductId: 'prod_phone_01',
      moderatedHidden: false,
      createdAt: now,
    },
    {
      id: 'live_atelier_sahel_01',
      slug: 'collection-cuir-et-soins-sahel',
      shopId: 'shop_atelier_sahel',
      vendorId: vendor2Id,
      shopName: 'Atelier Sahel & Cuir',
      shopSlug: 'atelier-sahel-cuir',
      title: 'Atelier en direct : Maroquinerie en cuir & Coffrets Beauté',
      description:
        'Découverte de notre nouvelle série de sacs en cuir cognac et conseils d’utilisation des soins botaniques.',
      category: 'Mode et vêtements',
      coverUrl: '/src/assets/images/live_shopping_studio_1794611253260.jpg',
      status: 'programme',
      streamType: 'youtube',
      streamUrl: '',
      youtubeUrl: '',
      youtubeVideoId: '',
      embedUrl: '',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      startedAt: null,
      endedAt: null,
      productIds: ['prod_sac_01', 'prod_mode_01', 'prod_beaute_01'],
      featuredProductId: 'prod_sac_01',
      moderatedHidden: false,
      createdAt: now,
    },
  ];

  return {
    users,
    shops,
    products,
    globalOrders: [],
    subOrders: [],
    lives,
    liveComments: [],
    threads: [],
    messages: [],
    notifications: [],
    reviews: [],
    reports: [],
    categories: DEFAULT_CATEGORIES,
    resetTokens: [],
  };
}

class MarketplaceStore {
  private state: DatabaseState;

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw) as DatabaseState;
      } catch {
        this.state = buildInitialState();
        this.persist();
      }
    } else {
      this.state = buildInitialState();
      this.persist();
    }
  }

  get data(): DatabaseState {
    return this.state;
  }

  persist(): void {
    const tmp = `${DB_FILE}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  }

  toPublicUser(user: StoredUser): User {
    const { passwordHash: _omit, ...pub } = user;
    return pub;
  }

  generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
  }

  generateProductReference(): string {
    const num = Math.floor(100000 + Math.random() * 899999);
    return `TSM-${num}`;
  }

  generateOrderNumber(prefix = 'CMD'): string {
    const num = Math.floor(10000 + Math.random() * 89999);
    return `${prefix}-${new Date().getFullYear().toString().slice(-2)}${num}`;
  }
}

export const store = new MarketplaceStore();
