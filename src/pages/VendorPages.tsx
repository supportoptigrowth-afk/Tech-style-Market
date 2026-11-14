import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Boxes,
  CheckCircle2,
  Edit3,
  ExternalLink,
  LayoutDashboard,
  MessageSquare,
  Minus,
  Package,
  Plus,
  PlusCircle,
  Radio,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Trash2,
  Upload,
  Video,
  Youtube,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LIVE_CATEGORIES,
  LIVE_STATUS_LABELS,
  NIGER_CITIES,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PRODUCT_CONDITIONS,
  PRODUCT_STATUS_LABELS,
  SHOP_STATUS_LABELS,
  formatFCFA,
} from '../constants';
import { useApp } from '../context/AppContext';
import {
  createLiveDoc,
  createProductDoc,
  createStoreDoc,
  deleteLiveDoc,
  deleteProductDoc,
  fetchVendorDashboardData,
  generateDocId,
  replyToReviewDoc,
  requestStoreCertificationDoc,
  sendDirectMessageDoc,
  slugifyText,
  subscribeConversations,
  subscribeUserMessages,
  updateLiveDetailsDoc,
  updateLiveStatusDoc,
  updateProductDoc,
  updateProductStockAndStatusDoc,
  updateStoreDoc,
  updateVendorOrderStatusDoc,
} from '../lib/firestoreService';
import { uploadSimpleMediaImage } from '../lib/mediaService';
import {
  attachYouTubeLinkToLiveOnServer,
  parseStrictYouTubeUrl,
  validateYouTubeLinkOnServer,
} from '../lib/youtube';
import type {
  DirectMessage,
  LiveSession,
  LiveStatus,
  MessageThread,
  OrderStatus,
  Product,
  ProductImageMeta,
  ProductStatus,
  Review,
  Shop,
  SubOrder,
} from '../types';
import { ProductPhotoManager } from '../components/ProductPhotoManager';
import { SafeImage } from '../components/SafeImage';
import { SocialShareBar } from '../components/SocialShareBar';

type VendorTab =
  | 'apercu'
  | 'produits'
  | 'ajouter_produit'
  | 'commandes'
  | 'stock'
  | 'boutique'
  | 'statistiques'
  | 'avis'
  | 'messages'
  | 'lives'
  | 'parametres';

export function CreateShopPage() {
  const { user, vendorShop, categories, navigate, refreshAuth, showToast } = useApp();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [city, setCity] = useState(user?.city || 'Niamey');
  const [description, setDescription] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState(user?.phone || '');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() =>
    categories[0]?.name ? [categories[0].name] : [],
  );
  const [logoUrl, setLogoUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('0');
  const [acceptedVendorTerms, setAcceptedVendorTerms] = useState(false);
  const [certificationRequested, setCertificationRequested] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <Store className="w-10 h-10 text-orange-600 mx-auto mb-3" />
        <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">
          Ouvrir votre boutique sur TECH STYLE MARKET
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Connectez-vous ou inscrivez-vous pour créer votre espace vendeur et publier vos produits.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/connexion')}
            className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Connexion
          </button>
          <button
            type="button"
            onClick={() => navigate('/inscription')}
            className="px-5 py-2.5 rounded-lg bg-orange-600 text-white text-sm font-semibold cursor-pointer"
          >
            Inscription
          </button>
        </div>
      </div>
    );
  }

  if (vendorShop) {
    return (
      <div className="max-w-lg mx-auto px-4 py-14 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h1 className="font-display font-bold text-xl text-[#0B1528] mb-2">
            Votre boutique « {vendorShop.name} » est active
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Gérez vos produits, commandes et diffusions en direct depuis votre tableau de bord vendeur.
          </p>
          <button
            type="button"
            onClick={() => navigate('/espace-vendeur')}
            className="px-6 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Accéder à mon espace vendeur
          </button>
        </div>
      </div>
    );
  }

  const slugPreview = slugifyText(slug || name || 'ma-boutique');

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'logo' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadSimpleMediaImage(file, 'store');
      if (target === 'logo') setLogoUrl(uploaded.url);
      else setCoverUrl(uploaded.url);
      showToast('Image téléversée sur Cloudinary.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur upload.', 'error');
    }
  };

  const toggleCategory = (catName: string) => {
    setSelectedCategories((prev) =>
      prev.includes(catName) ? prev.filter((c) => c !== catName) : [...prev, catName],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!acceptedVendorTerms) {
      setError('Vous devez accepter les conditions vendeurs pour créer votre boutique.');
      return;
    }
    setSubmitting(true);
    try {
      await createStoreDoc(user.id, {
        name,
        slug: slug || name,
        city,
        description,
        contactInfo,
        whatsappNumber,
        logoUrl,
        coverUrl,
        categories: selectedCategories,
        deliveryFee: Number(deliveryFee || 0),
        acceptedVendorTerms,
        certificationRequested,
      });
      await refreshAuth();
      showToast('Boutique créée avec succès !', 'success');
      navigate('/espace-vendeur');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-2">
        Créer votre boutique
      </h1>
      <p className="text-sm text-slate-600 mb-8">
        Configurez l’identité publique de votre boutique, vos catégories de produits, votre adresse
        personnalisée et votre numéro WhatsApp de réception des commandes.
      </p>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nom de la boutique
            </label>
            <input
              type="text"
              required
              minLength={3}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. Zinder Électronique"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Adresse publique souhaitée
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="zinder-electronique"
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-lg"
            />
            <p className="text-[11px] font-mono text-slate-500 mt-1 truncate">
              techstylemarket.com/boutique/{slugPreview}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Numéro WhatsApp vendeur
            </label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="+227 90 00 00 00"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Coordonnées &amp; adresse physique
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Quartier, rue, point de repère..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Frais de livraison standards (FCFA)
            </label>
            <input
              type="number"
              min="0"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              placeholder="0 si gratuit ou à convenir"
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-200 rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Description de la boutique
          </label>
          <textarea
            required
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Présentez vos produits, garanties et zones de livraison..."
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Catégories de produits vendues
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.name)}
                  onChange={() => toggleCategory(cat.name)}
                />
                <span>{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Logo de la boutique</label>
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <SafeImage src={logoUrl} alt="Aperçu logo" className="w-full h-full object-cover" />
            </div>
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'logo')} className="text-xs block w-full" />
          </div>
          <div className="p-3 rounded-lg border border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">Bannière / couverture</label>
            <div className="w-full h-16 rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <SafeImage src={coverUrl} alt="Aperçu bannière" className="w-full h-full object-cover" />
            </div>
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e, 'cover')} className="text-xs block w-full" />
          </div>
        </div>

        <div className="space-y-2.5 pt-2 border-t border-slate-100">
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={acceptedVendorTerms}
              onChange={(e) => setAcceptedVendorTerms(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              J’accepte les{' '}
              <button
                type="button"
                onClick={() => navigate('/conditions-generales')}
                className="text-orange-600 font-semibold hover:underline cursor-pointer"
              >
                conditions vendeurs TECH STYLE MARKET
              </button>{' '}
              et m’engage à proposer des produits conformes et disponibles.
            </span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={certificationRequested}
              onChange={(e) => setCertificationRequested(e.target.checked)}
            />
            <span>Demander la validation / certification par l’administration</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold cursor-pointer"
        >
          {submitting ? 'Création en cours...' : 'Créer ma boutique'}
        </button>
      </form>
    </div>
  );
}

interface VendorDashboardData {
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
}

export function VendorDashboardPage({ defaultTab = 'apercu' }: { defaultTab?: 'apercu' | 'produits' }) {
  const { user, categories, navigate, refreshAuth, showToast } = useApp();
  const [data, setData] = useState<VendorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<VendorTab>(defaultTab === 'produits' ? 'produits' : 'apercu');

  // Product list filter & delete modal state
  const [productFilter, setProductFilter] = useState<'tous' | ProductStatus>('tous');
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stock quick-edit buffer
  const [stockDrafts, setStockDrafts] = useState<Record<string, number>>({});
  const [savingStockId, setSavingStockId] = useState<string>('');

  // Product Form State (create or edit)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [draftProductId, setDraftProductId] = useState<string>(() => generateDocId('prod'));
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState(categories[0]?.name || 'Téléphones et accessoires');
  const [pPrice, setPPrice] = useState('');
  const [pPromoPrice, setPPromoPrice] = useState('');
  const [pStock, setPStock] = useState('10');
  const [pStatus, setPStatus] = useState<ProductStatus>('disponible');
  const [pCity, setPCity] = useState(user?.city || 'Niamey');
  const [pCondition, setPCondition] = useState<string>(PRODUCT_CONDITIONS[0]);
  const [pAdditionalInfo, setPAdditionalInfo] = useState('');
  const [pProductImages, setPProductImages] = useState<ProductImageMeta[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);

  // Live Form
  const [lTitle, setLTitle] = useState('');
  const [lDesc, setLDesc] = useState('');
  const [lCategory, setLCategory] = useState<string>(LIVE_CATEGORIES[0]);
  const [lCoverUrl, setLCoverUrl] = useState('');
  const [uploadingLiveCover, setUploadingLiveCover] = useState(false);
  const [lDate, setLDate] = useState('');
  const [lInitialStatus, setLInitialStatus] = useState<'programme' | 'en_preparation'>('programme');
  const [lYoutubeUrl, setLYoutubeUrl] = useState('');
  const [lProductIds, setLProductIds] = useState<string[]>([]);
  const [lFeaturedProductId, setLFeaturedProductId] = useState<string>('');
  const [creatingLive, setCreatingLive] = useState(false);
  const [liveYoutubeDrafts, setLiveYoutubeDrafts] = useState<Record<string, string>>({});
  const [savingLiveId, setSavingLiveId] = useState('');
  const [deleteLiveTarget, setDeleteLiveTarget] = useState<LiveSession | null>(null);

  // Shop Edit Form
  const [sName, setSName] = useState('');
  const [sSlug, setSSlug] = useState('');
  const [sCity, setSCity] = useState('');
  const [sWhatsapp, setSWhatsapp] = useState('');
  const [sContact, setSContact] = useState('');
  const [sDesc, setSDesc] = useState('');
  const [sLogo, setSLogo] = useState('');
  const [sCover, setSCover] = useState('');
  const [sDeliveryFee, setSDeliveryFee] = useState('0');
  const [sCategories, setSCategories] = useState<string[]>([]);

  // Vendor Messages
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [replyMsgText, setReplyMsgText] = useState('');

  // Reply reviews state
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (defaultTab === 'produits') setTab('produits');
  }, [defaultTab]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchVendorDashboardData(user.id);
      setData(res);
      if (res.shop) {
        setSName(res.shop.name);
        setSSlug(res.shop.slug);
        setSCity(res.shop.city);
        setSWhatsapp(res.shop.whatsappNumber);
        setSContact(res.shop.contactInfo);
        setSDesc(res.shop.description);
        setSLogo(res.shop.logoUrl);
        setSCover(res.shop.coverUrl);
        setSDeliveryFee(String(res.shop.deliveryFee || 0));
        setSCategories(res.shop.categories || []);
        setPCity(res.shop.city);
      }
      const nextDrafts: Record<string, number> = {};
      for (const p of res.products) nextDrafts[p.id] = p.stock;
      setStockDrafts(nextDrafts);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.roles.includes('vendor')) {
      void loadDashboard();
    } else {
      setLoading(false);
    }
  }, [user, loadDashboard]);

  useEffect(() => {
    if (!user) return;
    const unsubT = subscribeConversations(user.id, (list) => {
      setThreads(list);
      setActiveThreadId((prev) => (prev && list.some((t) => t.id === prev) ? prev : list[0]?.id || ''));
    });
    const unsubM = subscribeUserMessages(user.id, setMessages);
    return () => {
      unsubT();
      unsubM();
    };
  }, [user]);

  const filteredProducts = useMemo(() => {
    if (!data) return [];
    if (productFilter === 'tous') return data.products;
    return data.products.filter((p) => p.status === productFilter);
  }, [data, productFilter]);

  const salesByDay = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { dateLabel: string; orders: number; revenue: number }>();
    for (const o of data.orders) {
      if (o.status === 'annulee') continue;
      const dayKey = o.createdAt.slice(0, 10);
      const entry = map.get(dayKey) || {
        dateLabel: new Date(o.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        orders: 0,
        revenue: 0,
      };
      entry.orders += 1;
      if (o.status === 'livree') {
        entry.revenue += o.subtotal;
      }
      map.set(dayKey, entry);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([, val]) => val);
  }, [data]);

  const topSoldProducts = useMemo(() => {
    if (!data) return [];
    return [...data.products].sort((a, b) => b.salesCount - a.salesCount).slice(0, 5);
  }, [data]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <p className="text-sm text-slate-600 mb-4">Connectez-vous pour accéder à l’espace vendeur.</p>
        <button
          type="button"
          onClick={() => navigate('/connexion')}
          className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Connexion
        </button>
      </div>
    );
  }

  if (!user.roles.includes('vendor') || (!loading && !data?.shop)) {
    return <CreateShopPage />;
  }

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="h-72 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  const shop = data.shop!;

  const openNewProductTab = () => {
    setEditingProduct(null);
    setDraftProductId(generateDocId('prod'));
    setPName('');
    setPDesc('');
    setPCategory(categories[0]?.name || 'Téléphones et accessoires');
    setPPrice('');
    setPPromoPrice('');
    setPStock('10');
    setPStatus('disponible');
    setPCity(shop.city || 'Niamey');
    setPCondition(PRODUCT_CONDITIONS[0]);
    setPAdditionalInfo('');
    setPProductImages([]);
    setTab('ajouter_produit');
  };

  const openEditProductTab = (prod: Product) => {
    setEditingProduct(prod);
    setPName(prod.name);
    setPDesc(prod.description);
    setPCategory(prod.category);
    setPPrice(String(prod.price));
    setPPromoPrice(prod.promoPrice ? String(prod.promoPrice) : '');
    setPStock(String(prod.stock));
    setPStatus(prod.status);
    setPCity(prod.city || shop.city);
    setPCondition(prod.condition || PRODUCT_CONDITIONS[0]);
    setPAdditionalInfo(prod.additionalInfo || '');
    const initialMeta: ProductImageMeta[] =
      prod.productImages && prod.productImages.length > 0
        ? prod.productImages
        : prod.images.map((url, idx) => ({
            fileId: `legacy_${idx}`,
            url,
            isPrimary: idx === 0,
            order: idx,
            uploadedAt: prod.createdAt,
          }));
    setPProductImages(initialMeta);
    setTab('ajouter_produit');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pProductImages.length === 0 && pStatus !== 'brouillon') {
      showToast(
        'Ajoutez au moins une photo avant de publier ce produit (ou passez le statut en Brouillon).',
        'error',
      );
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        name: pName,
        description: pDesc,
        category: pCategory,
        price: Number(pPrice),
        promoPrice: pPromoPrice ? Number(pPromoPrice) : null,
        stock: Number(pStock),
        city: pCity,
        condition: pCondition,
        additionalInfo: pAdditionalInfo,
        images: pProductImages.map((p) => p.url),
        productImages: pProductImages,
      };
      if (editingProduct) {
        await updateProductDoc(editingProduct.id, { ...payload, status: pStatus });
        showToast('Produit mis à jour.', 'success');
      } else {
        const createStatus = pStatus === 'masque' ? 'brouillon' : pStatus;
        await createProductDoc(user.id, shop, {
          ...payload,
          productId: draftProductId,
          status: createStatus,
        });
        showToast('Produit enregistré.', 'success');
      }
      setEditingProduct(null);
      setTab('produits');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur produit.', 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleArchiveProduct = async (prod: Product) => {
    const nextStatus: ProductStatus =
      prod.status === 'masque' ? (prod.stock > 0 ? 'disponible' : 'rupture') : 'masque';
    try {
      await updateProductStockAndStatusDoc(prod.id, prod.stock, nextStatus);
      showToast(
        nextStatus === 'masque' ? 'Produit archivé (masqué du catalogue).' : 'Produit republié.',
        'success',
      );
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur archivage.', 'error');
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProductDoc(deleteTarget.id);
      showToast('Produit supprimé définitivement.', 'info');
      setDeleteTarget(null);
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur suppression.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveStockRow = async (prod: Product, nextStock: number, nextStatus?: ProductStatus) => {
    setSavingStockId(prod.id);
    try {
      await updateProductStockAndStatusDoc(prod.id, nextStock, nextStatus || prod.status);
      showToast(`Stock mis à jour pour « ${prod.name} ».`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur stock.', 'error');
    } finally {
      setSavingStockId('');
    }
  };

  const handleOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateVendorOrderStatusDoc(orderId, status);
      showToast(`Commande passée en : ${ORDER_STATUS_LABELS[status]}`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur statut.', 'error');
    }
  };

  const handleLiveCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLiveCover(true);
    try {
      const uploaded = await uploadSimpleMediaImage(file, 'live', shop.id);
      setLCoverUrl(uploaded.url);
      showToast('Image de couverture téléversée sur Cloudinary.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors du téléversement.', 'error');
    } finally {
      setUploadingLiveCover(false);
      e.target.value = '';
    }
  };

  const handleCreateLive = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingLive(true);
    try {
      let youtubeUrl = '';
      let youtubeVideoId = '';
      let embedUrl = '';

      if (lYoutubeUrl.trim()) {
        const validated = await validateYouTubeLinkOnServer(lYoutubeUrl.trim());
        youtubeUrl = validated.youtubeUrl;
        youtubeVideoId = validated.videoId;
        embedUrl = validated.embedUrl;
      }

      await createLiveDoc(user.id, shop, {
        title: lTitle,
        description: lDesc,
        category: lCategory,
        coverUrl: lCoverUrl || shop.coverUrl,
        scheduledAt: lDate || new Date().toISOString(),
        youtubeUrl,
        youtubeVideoId,
        embedUrl,
        initialStatus: lInitialStatus,
        productIds: lProductIds,
        featuredProductId: lFeaturedProductId || lProductIds[0] || null,
      });

      setLTitle('');
      setLDesc('');
      setLCoverUrl('');
      setLYoutubeUrl('');
      setLProductIds([]);
      setLFeaturedProductId('');
      showToast('Session Live Shopping enregistrée !', 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur programmation live.', 'error');
    } finally {
      setCreatingLive(false);
    }
  };

  const handleAttachLiveYouTube = async (liveId: string) => {
    const url = (liveYoutubeDrafts[liveId] || '').trim();
    if (!url) {
      showToast('Collez votre lien YouTube Live avant d’enregistrer.', 'error');
      return;
    }
    setSavingLiveId(liveId);
    try {
      await attachYouTubeLinkToLiveOnServer(liveId, url);
      showToast('Lien YouTube Live validé et associé à la session.', 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lien YouTube invalide.', 'error');
    } finally {
      setSavingLiveId('');
    }
  };

  const handleLiveStatusChange = async (live: LiveSession, status: LiveStatus) => {
    setSavingLiveId(live.id);
    try {
      await updateLiveStatusDoc(live.id, status);
      showToast(`Statut mis à jour : ${LIVE_STATUS_LABELS[status]}.`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossible de changer le statut.', 'error');
    } finally {
      setSavingLiveId('');
    }
  };

  const handleToggleLiveProduct = async (live: LiveSession, productId: string) => {
    const exists = live.productIds.includes(productId);
    const nextIds = exists
      ? live.productIds.filter((id) => id !== productId)
      : [...live.productIds, productId].slice(0, 30);
    const nextFeatured =
      live.featuredProductId && nextIds.includes(live.featuredProductId)
        ? live.featuredProductId
        : nextIds[0] || null;
    try {
      await updateLiveDetailsDoc(live.id, {
        productIds: nextIds,
        featuredProductId: nextFeatured,
      });
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour produits.', 'error');
    }
  };

  const handleMoveLiveProduct = async (live: LiveSession, index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= live.productIds.length) return;
    const next = [...live.productIds];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    try {
      await updateLiveDetailsDoc(live.id, { productIds: next });
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur ordre produits.', 'error');
    }
  };

  const handleSpotlightLiveProduct = async (live: LiveSession, productId: string) => {
    try {
      await updateLiveDetailsDoc(live.id, { featuredProductId: productId });
      showToast('Produit mis en avant pour les spectateurs.', 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise en avant.', 'error');
    }
  };

  const confirmDeleteLive = async () => {
    if (!deleteLiveTarget) return;
    setSavingLiveId(deleteLiveTarget.id);
    try {
      await deleteLiveDoc(deleteLiveTarget.id);
      showToast('Session Live supprimée.', 'info');
      setDeleteLiveTarget(null);
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur suppression live.', 'error');
    } finally {
      setSavingLiveId('');
    }
  };

  const handleShopMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'logo' | 'cover',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const uploaded = await uploadSimpleMediaImage(file, 'store', shop.id);
      if (target === 'logo') setSLogo(uploaded.url);
      else setSCover(uploaded.url);
      showToast('Image téléversée sur Cloudinary. Cliquez sur Enregistrer.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur upload.', 'error');
    }
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateStoreDoc(shop.id, {
        name: sName,
        slug: sSlug,
        city: sCity,
        whatsappNumber: sWhatsapp,
        contactInfo: sContact,
        description: sDesc,
        logoUrl: sLogo,
        coverUrl: sCover,
        deliveryFee: Number(sDeliveryFee || 0),
        categories: sCategories,
      });
      await refreshAuth();
      await loadDashboard();
      showToast('Informations de la boutique enregistrées.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur mise à jour.', 'error');
    }
  };

  const handleRequestVerification = async () => {
    try {
      await requestStoreCertificationDoc(shop.id);
      await loadDashboard();
      showToast('Demande de vérification envoyée à l’administration.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  };

  const handleReplyReview = async (reviewId: string) => {
    const reply = replyTexts[reviewId];
    if (!reply?.trim()) return;
    try {
      await replyToReviewDoc(reviewId, reply);
      showToast('Réponse publiée.', 'success');
      await loadDashboard();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur.', 'error');
    }
  };

  const handleSendVendorMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !replyMsgText.trim()) return;
    try {
      await sendDirectMessageDoc({
        sender: user,
        threadId: activeThreadId,
        text: replyMsgText,
      });
      setReplyMsgText('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur envoi message.', 'error');
    }
  };

  const navItems: Array<{ id: VendorTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }> = [
    { id: 'apercu', label: 'Vue d’ensemble', icon: LayoutDashboard },
    { id: 'produits', label: 'Mes produits', icon: Package, badge: data.products.length },
    { id: 'ajouter_produit', label: editingProduct ? 'Modifier produit' : 'Ajouter un produit', icon: PlusCircle },
    { id: 'commandes', label: 'Mes commandes', icon: Boxes, badge: data.orders.length },
    { id: 'stock', label: 'Gestion du stock', icon: Archive },
    { id: 'boutique', label: 'Ma boutique', icon: Store },
    { id: 'statistiques', label: 'Mes statistiques', icon: BarChart3 },
    { id: 'avis', label: 'Mes avis', icon: Star, badge: data.reviews.length },
    { id: 'messages', label: 'Mes messages', icon: MessageSquare, badge: threads.length },
    { id: 'lives', label: 'Mes lives', icon: Video, badge: data.lives.length },
    { id: 'parametres', label: 'Paramètres', icon: Settings },
  ];

  const publicShopUrl = `${window.location.origin}/boutique/${shop.slug}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Vendor Header */}
      <div className="bg-[#0B1528] text-white rounded-xl p-6 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#132342] border border-[#1D345E] shrink-0">
            <SafeImage src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-orange-400 font-semibold mb-1">
              <span>Espace Vendeur</span>
              <span>·</span>
              <span>{SHOP_STATUS_LABELS[shop.verifiedStatus]}</span>
            </div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl truncate">{shop.name}</h1>
            <p className="text-xs text-slate-300 mt-1 font-mono truncate">
              techstylemarket.com/boutique/{shop.slug}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/boutique/${shop.slug}`)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-600 text-xs font-semibold hover:border-orange-500 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Voir ma boutique</span>
          </button>
          <button
            type="button"
            onClick={openNewProductTab}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un produit</span>
          </button>
        </div>
      </div>

      {/* Main Sidebar + Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-2.5 lg:sticky lg:top-24">
          <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1" aria-label="Menu espace vendeur">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === 'ajouter_produit' && tab !== 'ajouter_produit') {
                      openNewProductTab();
                    } else {
                      setTab(item.id);
                    }
                  }}
                  className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-colors cursor-pointer ${
                    active ? 'bg-[#0B1528] text-white' : 'text-slate-700 hover:bg-slate-100'
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

        <div className="lg:col-span-9 space-y-6">
          {/* 1. VUE D'ENSEMBLE */}
          {tab === 'apercu' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">CA commandes livrées</p>
                  <p className="font-mono font-bold text-xl text-[#0B1528] tabular-nums">
                    {formatFCFA(data.stats.totalRevenue)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Commandes (Attente / Total)</p>
                  <p className="font-mono font-bold text-xl text-[#0B1528] tabular-nums">
                    <span className="text-orange-600">{data.stats.pendingOrders}</span> / {data.stats.totalOrders}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Produits (Dispo / Épuisés)</p>
                  <p className="font-mono font-bold text-xl text-[#0B1528] tabular-nums">
                    {data.stats.availableProducts} /{' '}
                    <span className="text-red-600">{data.stats.outOfStockProducts}</span>
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <p className="text-xs text-slate-500 mb-1">Visiteurs boutique</p>
                  <p className="font-mono font-bold text-xl text-[#0B1528] tabular-nums">
                    {data.stats.visitorCount}
                  </p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display font-bold text-lg text-[#0B1528]">
                    Dernières commandes reçues
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab('commandes')}
                    className="text-xs font-semibold text-orange-600 hover:underline cursor-pointer"
                  >
                    Gérer les commandes →
                  </button>
                </div>
                {data.orders.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune commande reçue pour l’instant.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs text-slate-500">
                          <th className="pb-3 font-semibold">Réf</th>
                          <th className="pb-3 font-semibold">Client</th>
                          <th className="pb-3 font-semibold">Ville</th>
                          <th className="pb-3 font-semibold text-right">Montant</th>
                          <th className="pb-3 font-semibold text-right">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.orders.slice(0, 6).map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="py-3 font-mono text-xs">{o.orderNumber}</td>
                            <td className="py-3 font-medium">{o.customerName}</td>
                            <td className="py-3 text-slate-600">{o.customerCity}</td>
                            <td className="py-3 text-right font-mono tabular-nums">{formatFCFA(o.subtotal)}</td>
                            <td className="py-3 text-right text-xs font-semibold text-orange-600">
                              {ORDER_STATUS_LABELS[o.status]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. MES PRODUITS */}
          {tab === 'produits' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Mes produits</h2>
                <button
                  type="button"
                  onClick={openNewProductTab}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter un produit</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 rounded-lg w-fit">
                {(
                  [
                    { id: 'tous', label: `Tous (${data.products.length})` },
                    { id: 'disponible', label: 'Publiés' },
                    { id: 'brouillon', label: 'Brouillons' },
                    { id: 'rupture', label: 'Rupture de stock' },
                    { id: 'masque', label: 'Archivés' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setProductFilter(f.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                      productFilter === f.id ? 'bg-white text-[#0B1528] shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredProducts.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Aucun produit dans cette catégorie de statut.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                      <div className="aspect-[4/3] bg-slate-100 relative">
                        <SafeImage src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-[#0B1528]/85 text-white text-[10px] font-semibold">
                          {PRODUCT_STATUS_LABELS[p.status]}
                        </span>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span className="font-mono">{p.reference}</span>
                          <span>Stock : {p.stock}</span>
                        </div>
                        <h3 className="font-display font-semibold text-sm text-[#0B1528] line-clamp-2 mb-1">
                          {p.name}
                        </h3>
                        <p className="font-mono font-bold text-sm text-orange-600 mb-4 tabular-nums">
                          {formatFCFA(p.promoPrice ?? p.price)}
                        </p>
                        <div className="mt-auto flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditProductTab(p)}
                            className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleArchiveProduct(p)}
                            className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                            title={p.status === 'masque' ? 'Republier' : 'Archiver'}
                          >
                            {p.status === 'masque' ? 'Republier' : 'Archiver'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                            aria-label="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. AJOUTER / MODIFIER UN PRODUIT */}
          {tab === 'ajouter_produit' && (
            <form
              onSubmit={handleSaveProduct}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">
                  {editingProduct ? `Modifier « ${editingProduct.name} »` : 'Publier un nouveau produit'}
                </h2>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setTab('produits');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Annuler la modification
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom du produit</label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Ex. Smartphone Ultra Pro 256 Go"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prix (FCFA)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prix promo (optionnel)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pPromoPrice}
                    onChange={(e) => setPPromoPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quantité disponible
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Statut</label>
                  <select
                    value={pStatus}
                    onChange={(e) => setPStatus(e.target.value as ProductStatus)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="disponible">Publié</option>
                    <option value="brouillon">Brouillon</option>
                    <option value="rupture">Rupture de stock</option>
                    {editingProduct && <option value="masque">Archivé</option>}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">État du produit</label>
                  <select
                    value={pCondition}
                    onChange={(e) => setPCondition(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {PRODUCT_CONDITIONS.map((cond) => (
                      <option key={cond} value={cond}>
                        {cond}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ville d’expédition</label>
                  <select
                    value={pCity}
                    onChange={(e) => setPCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {NIGER_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description détaillée
                </label>
                <textarea
                  rows={4}
                  required
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  placeholder="Caractéristiques, contenu du coffret, compatibilité..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Informations complémentaires (garantie, délai de livraison, dimensions...)
                </label>
                <textarea
                  rows={2}
                  value={pAdditionalInfo}
                  onChange={(e) => setPAdditionalInfo(e.target.value)}
                  placeholder="Ex. Garantie constructeur 12 mois, livraison le jour même à Niamey..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <ProductPhotoManager
                userId={user.id}
                productId={editingProduct?.id || draftProductId}
                isExistingProduct={Boolean(editingProduct)}
                photos={pProductImages}
                onChange={setPProductImages}
                onStatusMessage={showToast}
              />

              <button
                type="submit"
                disabled={savingProduct}
                className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold cursor-pointer"
              >
                {savingProduct
                  ? 'Enregistrement...'
                  : editingProduct
                    ? 'Enregistrer les modifications'
                    : 'Publier le produit'}
              </button>
            </form>
          )}

          {/* 4. MES COMMANDES */}
          {tab === 'commandes' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Commandes reçues</h2>
                {data.stats.pendingOrders > 0 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700">
                    {data.stats.pendingOrders} commande(s) en attente de validation
                  </span>
                )}
              </div>
              {data.orders.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
                  Aucune commande reçue pour le moment.
                </div>
              ) : (
                data.orders.map((order) => (
                  <div
                    key={order.id}
                    className={`bg-white border rounded-xl p-5 space-y-4 ${
                      order.status === 'en_attente' ? 'border-orange-300' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs text-slate-500">
                          {order.orderNumber} · Lot {order.globalOrderNumber} ·{' '}
                          {new Date(order.createdAt).toLocaleString('fr-FR')}
                        </p>
                        <p className="font-display font-semibold text-base text-[#0B1528]">
                          {order.customerName} ({order.customerPhone})
                        </p>
                        <p className="text-xs text-slate-600">
                          Livraison : {order.deliveryAddress}, {order.customerCity}
                        </p>
                        {order.notes && (
                          <p className="text-xs text-slate-500 italic mt-0.5">
                            Note client : « {order.notes} »
                          </p>
                        )}
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="font-mono font-bold text-lg text-[#0B1528] tabular-nums">
                          {formatFCFA(order.subtotal)}
                        </p>
                        {order.deliveryFee !== undefined && order.deliveryFee > 0 && (
                          <p className="text-[11px] text-slate-500 font-mono">
                            dont livraison : {formatFCFA(order.deliveryFee)}
                          </p>
                        )}
                        <p
                          className={`text-xs font-semibold ${
                            order.status === 'annulee'
                              ? 'text-red-600'
                              : order.status === 'livree'
                                ? 'text-emerald-700'
                                : 'text-orange-600'
                          }`}
                        >
                          {ORDER_STATUS_LABELS[order.status]}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {order.items.map((item) => (
                        <div key={`${order.id}-${item.productId}`} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded overflow-hidden bg-white border border-slate-200 shrink-0">
                              <SafeImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-[#0B1528] truncate">{item.name}</p>
                              <p className="text-slate-500 font-mono">
                                {item.quantity} × {formatFCFA(item.unitPrice)}
                              </p>
                            </div>
                          </div>
                          <span className="font-mono font-semibold text-[#0B1528] shrink-0 tabular-nums">
                            {formatFCFA(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {order.status !== 'livree' && order.status !== 'annulee' && (
                      <div className="space-y-2.5">
                        {order.status === 'en_attente' && (
                          <div className="flex flex-wrap gap-2 pb-2 border-b border-slate-100">
                            <button
                              type="button"
                              onClick={() => void handleOrderStatus(order.id, 'confirmee')}
                              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                            >
                              Accepter la commande
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleOrderStatus(order.id, 'annulee')}
                              className="px-4 py-2 rounded-lg border border-red-300 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold cursor-pointer"
                            >
                              Refuser la commande
                            </button>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {ORDER_STATUS_FLOW.map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={order.status === st}
                              onClick={() => void handleOrderStatus(order.id, st)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                                order.status === st
                                  ? 'bg-[#0B1528] text-white border-[#0B1528]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-orange-500'
                              }`}
                            >
                              {ORDER_STATUS_LABELS[st]}
                            </button>
                          ))}
                          {order.status !== 'en_attente' && (
                            <button
                              type="button"
                              onClick={() => void handleOrderStatus(order.id, 'annulee')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 5. GESTION DU STOCK */}
          {tab === 'stock' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-xl text-[#0B1528]">Gestion rapide du stock</h2>
                  <p className="text-xs text-slate-500">
                    Ajustez vos quantités disponibles. Un stock à 0 passe automatiquement en « Rupture de stock ».
                  </p>
                </div>
                <div className="text-xs font-mono text-slate-600">
                  Disponibles : {data.stats.availableProducts} · Épuisés : {data.stats.outOfStockProducts}
                </div>
              </div>

              {data.products.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">Aucun produit dans votre inventaire.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.products.map((prod) => {
                    const draft = stockDrafts[prod.id] ?? prod.stock;
                    const busy = savingStockId === prod.id;
                    return (
                      <div
                        key={prod.id}
                        className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                            <SafeImage src={prod.images[0]} alt={prod.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-display font-semibold text-sm text-[#0B1528] truncate">
                              {prod.name}
                            </p>
                            <p className="text-xs text-slate-500 font-mono">
                              {prod.reference} · {PRODUCT_STATUS_LABELS[prod.status]}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div className="inline-flex items-center border border-slate-200 rounded-lg">
                            <button
                              type="button"
                              onClick={() =>
                                setStockDrafts((prev) => ({
                                  ...prev,
                                  [prod.id]: Math.max(0, draft - 1),
                                }))
                              }
                              className="p-2 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                              aria-label="Diminuer le stock"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={draft}
                              onChange={(e) =>
                                setStockDrafts((prev) => ({
                                  ...prev,
                                  [prod.id]: Math.max(0, Math.floor(Number(e.target.value || 0))),
                                }))
                              }
                              className="w-16 text-center text-xs font-mono font-bold py-1.5 focus:outline-none tabular-nums"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setStockDrafts((prev) => ({
                                  ...prev,
                                  [prod.id]: draft + 1,
                                }))
                              }
                              className="p-2 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                              aria-label="Augmenter le stock"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <select
                            value={prod.status}
                            onChange={(e) =>
                              void handleSaveStockRow(prod, draft, e.target.value as ProductStatus)
                            }
                            className="px-2.5 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                          >
                            <option value="disponible">Publié</option>
                            <option value="rupture">Rupture</option>
                            <option value="brouillon">Brouillon</option>
                            <option value="masque">Archivé</option>
                          </select>

                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleSaveStockRow(prod, draft)}
                            className="px-3.5 py-2 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                          >
                            {busy ? '...' : 'Appliquer'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 6. MA BOUTIQUE */}
          {tab === 'boutique' && (
            <div className="space-y-6">
              {/* Verification status banner */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className={`w-6 h-6 shrink-0 ${
                      shop.verifiedStatus === 'verified'
                        ? 'text-emerald-600'
                        : shop.verifiedStatus === 'suspended'
                          ? 'text-red-600'
                          : 'text-orange-600'
                    }`}
                  />
                  <div>
                    <p className="font-display font-bold text-sm text-[#0B1528]">
                      Statut de vérification : {SHOP_STATUS_LABELS[shop.verifiedStatus]}
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {shop.verifiedStatus === 'verified'
                        ? 'Votre boutique est certifiée par l’administration TECH STYLE MARKET.'
                        : shop.verifiedStatus === 'pending'
                          ? 'Votre demande est en cours d’examen par un administrateur.'
                          : shop.verifiedStatus === 'suspended'
                            ? 'Votre boutique est suspendue. Contactez le support.'
                            : 'Vous pouvez demander la vérification officielle de votre boutique.'}
                    </p>
                  </div>
                </div>
                {shop.verifiedStatus === 'unverified' && (
                  <button
                    type="button"
                    onClick={() => void handleRequestVerification()}
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Demander la vérification
                  </button>
                )}
              </div>

              <form
                onSubmit={handleSaveShop}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <h2 className="font-display font-bold text-lg text-[#0B1528]">
                  Modifier les informations de la boutique
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Logo</label>
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <SafeImage src={sLogo} alt={sName} className="w-full h-full object-cover" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleShopMediaUpload(e, 'logo')}
                      className="text-xs block w-full"
                    />
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Bannière / couverture</label>
                    <div className="w-full h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <SafeImage src={sCover} alt={sName} className="w-full h-full object-cover" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleShopMediaUpload(e, 'cover')}
                      className="text-xs block w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de la boutique</label>
                    <input
                      type="text"
                      required
                      value={sName}
                      onChange={(e) => setSName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Lien public (/boutique/...)</label>
                    <input
                      type="text"
                      required
                      value={sSlug}
                      onChange={(e) => setSSlug(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ville</label>
                    <select
                      value={sCity}
                      onChange={(e) => setSCity(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      {NIGER_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Numéro WhatsApp</label>
                    <input
                      type="tel"
                      value={sWhatsapp}
                      onChange={(e) => setSWhatsapp(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Coordonnées / Adresse</label>
                    <input
                      type="text"
                      value={sContact}
                      onChange={(e) => setSContact(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Frais de livraison standards (FCFA)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sDeliveryFee}
                      onChange={(e) => setSDeliveryFee(e.target.value)}
                      placeholder="0 si gratuit / à convenir"
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={sDesc}
                    onChange={(e) => setSDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    Catégories proposées
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-slate-200 rounded-lg max-h-40 overflow-y-auto">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sCategories.includes(cat.name)}
                          onChange={() =>
                            setSCategories((prev) =>
                              prev.includes(cat.name)
                                ? prev.filter((x) => x !== cat.name)
                                : [...prev, cat.name],
                            )
                          }
                        />
                        <span>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </form>
            </div>
          )}

          {/* 7. MES STATISTIQUES (strictement réelles) */}
          {tab === 'statistiques' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Statistiques réelles</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toutes les données sont calculées en direct depuis Firestore. Le chiffre d’affaires
                  comptabilise uniquement les commandes au statut « Livrée ».
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">CA réel livré</p>
                  <p className="font-mono font-bold text-lg text-[#0B1528] tabular-nums mt-1">
                    {formatFCFA(data.stats.totalRevenue)}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Commandes livrées</p>
                  <p className="font-mono font-bold text-lg text-emerald-700 tabular-nums mt-1">
                    {data.stats.deliveredOrders}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Confirmées / En cours</p>
                  <p className="font-mono font-bold text-lg text-[#0B1528] tabular-nums mt-1">
                    {data.stats.confirmedOrders}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">En attente</p>
                  <p className="font-mono font-bold text-lg text-orange-600 tabular-nums mt-1">
                    {data.stats.pendingOrders}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Total produits</p>
                  <p className="font-mono font-bold text-lg text-[#0B1528] tabular-nums mt-1">
                    {data.stats.productCount}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Produits disponibles</p>
                  <p className="font-mono font-bold text-lg text-emerald-700 tabular-nums mt-1">
                    {data.stats.availableProducts}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Produits épuisés</p>
                  <p className="font-mono font-bold text-lg text-red-600 tabular-nums mt-1">
                    {data.stats.outOfStockProducts}
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <p className="text-xs text-slate-500">Visites boutique</p>
                  <p className="font-mono font-bold text-lg text-[#0B1528] tabular-nums mt-1">
                    {data.stats.visitorCount}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h3 className="font-display font-bold text-base text-[#0B1528]">
                    Évolution récente des ventes
                  </h3>
                  {salesByDay.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Aucune vente enregistrée pour afficher une courbe d’activité.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {salesByDay.map((d) => {
                        const maxOrders = Math.max(...salesByDay.map((x) => x.orders), 1);
                        const pct = Math.round((d.orders / maxOrders) * 100);
                        return (
                          <div key={d.dateLabel} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="font-medium text-slate-700">{d.dateLabel}</span>
                              <span className="font-mono text-[#0B1528] tabular-nums">
                                {d.orders} cmd · {formatFCFA(d.revenue)} livrés
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full bg-orange-600 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h3 className="font-display font-bold text-base text-[#0B1528]">
                    Produits les plus vendus
                  </h3>
                  {topSoldProducts.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun produit publié.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {topSoldProducts.map((p) => (
                        <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <span className="font-medium text-[#0B1528] truncate">{p.name}</span>
                          <span className="font-mono font-semibold text-orange-600 shrink-0 tabular-nums">
                            {p.salesCount} vente{p.salesCount > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 8. MES AVIS */}
          {tab === 'avis' && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-xl text-[#0B1528]">Avis clients reçus</h2>
              {data.reviews.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                  Aucun avis client pour le moment.
                </div>
              ) : (
                data.reviews.map((rev) => (
                  <div key={rev.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-[#0B1528]">{rev.userName}</span>
                      <span className="font-mono text-orange-600">{rev.rating}/5</span>
                    </div>
                    <p className="text-sm text-slate-700">{rev.comment}</p>
                    {rev.vendorReply ? (
                      <p className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <span className="font-semibold">Votre réponse : </span>
                        {rev.vendorReply}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyTexts[rev.id] || ''}
                          onChange={(e) => setReplyTexts((p) => ({ ...p, [rev.id]: e.target.value }))}
                          placeholder="Répondre à cet avis..."
                          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => void handleReplyReview(rev.id)}
                          className="px-4 py-2 bg-[#0B1528] text-white text-xs font-semibold rounded-lg cursor-pointer"
                        >
                          Répondre
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* 9. MES MESSAGES */}
          {tab === 'messages' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-xl text-[#0B1528]">Messagerie clients</h2>
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
                  Aucun message client pour le moment.
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
                      {messages
                        .filter((m) => m.threadId === activeThreadId)
                        .map((m) => (
                          <div
                            key={m.id}
                            className={`max-w-[80%] px-3.5 py-2 rounded-xl text-xs ${
                              m.senderId === user.id
                                ? 'ml-auto bg-[#0B1528] text-white'
                                : 'bg-white border border-slate-200 text-[#0B1528]'
                            }`}
                          >
                            <p>{m.text}</p>
                          </div>
                        ))}
                    </div>
                    <form onSubmit={handleSendVendorMessage} className="p-3 border-t border-slate-200 flex gap-2">
                      <input
                        type="text"
                        value={replyMsgText}
                        onChange={(e) => setReplyMsgText(e.target.value)}
                        placeholder="Répondre au client..."
                        className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg"
                      />
                      <button
                        type="submit"
                        disabled={!replyMsgText.trim()}
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

          {/* 10. MES LIVES (YouTube Live + Gestion produits en direct) */}
          {tab === 'lives' && (
            <div className="space-y-8">
              {/* Guide YouTube Studio sans frais */}
              <div className="bg-[#0B1528] text-white rounded-xl p-6 border border-[#1D345E]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
                      <Youtube className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-lg">
                        Diffuser gratuitement avec YouTube Live
                      </h2>
                      <p className="text-xs text-slate-300">
                        Diffusez depuis votre chaîne YouTube sur mobile ou PC et intégrez votre lien
                        dans TECH STYLE MARKET sans serveur payant.
                      </p>
                    </div>
                  </div>
                  <a
                    href="https://studio.youtube.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Ouvrir YouTube Studio</span>
                  </a>
                </div>
                <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-slate-200">
                  <li className="bg-[#132342] rounded-lg px-3 py-2 border border-[#1D345E]">
                    <span className="font-bold text-orange-400">1.</span> Ouvrir YouTube Studio
                  </li>
                  <li className="bg-[#132342] rounded-lg px-3 py-2 border border-[#1D345E]">
                    <span className="font-bold text-orange-400">2.</span> Créer ou programmer un live
                  </li>
                  <li className="bg-[#132342] rounded-lg px-3 py-2 border border-[#1D345E]">
                    <span className="font-bold text-orange-400">3.</span> Copier le lien du live (Non répertorié ou Public)
                  </li>
                  <li className="bg-[#132342] rounded-lg px-3 py-2 border border-[#1D345E]">
                    <span className="font-bold text-orange-400">4.</span> Revenir dans TECH STYLE MARKET
                  </li>
                  <li className="bg-[#132342] rounded-lg px-3 py-2 border border-[#1D345E]">
                    <span className="font-bold text-orange-400">5.</span> Coller le lien YouTube dans la session
                  </li>
                  <li className="bg-[#132342] rounded-lg px-3 py-2 border border-[#1D345E]">
                    <span className="font-bold text-orange-400">6.</span> Enregistrer et confirmer « En direct »
                  </li>
                </ol>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Formulaire Programmer un live */}
                <form
                  onSubmit={handleCreateLive}
                  className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-orange-600" />
                    <h2 className="font-display font-bold text-lg text-[#0B1528]">
                      Programmer un live
                    </h2>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Titre du live *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={lTitle}
                      onChange={(e) => setLTitle(e.target.value)}
                      placeholder="Ex. Vente flash smartphones & montres connectées"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={lDesc}
                      onChange={(e) => setLDesc(e.target.value)}
                      placeholder="Présentez les promotions ou thèmes de cette session..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Catégorie du live
                      </label>
                      <select
                        value={lCategory}
                        onChange={(e) => setLCategory(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        {LIVE_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Statut initial
                      </label>
                      <select
                        value={lInitialStatus}
                        onChange={(e) =>
                          setLInitialStatus(e.target.value as 'programme' | 'en_preparation')
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="programme">Programmé</option>
                        <option value="en_preparation">En préparation</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Date &amp; heure de diffusion *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={lDate}
                      onChange={(e) => setLDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>

                  {/* Image de couverture Cloudinary */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Image de couverture (Cloudinary)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-12 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <SafeImage
                          src={lCoverUrl || shop.coverUrl}
                          alt="Couverture live"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-[#0B1528] cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-orange-600" />
                        <span>
                          {uploadingLiveCover ? 'Envoi...' : 'Choisir une image'}
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingLiveCover}
                          onChange={(e) => void handleLiveCoverUpload(e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Lien YouTube Live (optionnel à la création)
                    </label>
                    <input
                      type="url"
                      value={lYoutubeUrl}
                      onChange={(e) => setLYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... ou https://youtu.be/..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                    {lYoutubeUrl.trim() && (
                      <p
                        className={`text-[11px] mt-1 ${
                          parseStrictYouTubeUrl(lYoutubeUrl) ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {parseStrictYouTubeUrl(lYoutubeUrl)
                          ? `Vidéo YouTube reconnue (ID : ${parseStrictYouTubeUrl(lYoutubeUrl)!.videoId})`
                          : 'Lien invalide. Formats acceptés : youtube.com/watch?v=, youtube.com/live/, youtu.be/, youtube.com/embed/.'}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Produits à présenter ({lProductIds.length} sélectionné{lProductIds.length > 1 ? 's' : ''})
                    </label>
                    {data.products.filter((p) => p.status === 'disponible' || p.status === 'rupture')
                      .length === 0 ? (
                      <p className="text-xs text-slate-500 border border-slate-200 rounded-lg p-3">
                        Publiez d’abord des produits dans votre boutique pour les associer à un live.
                      </p>
                    ) : (
                      <div className="max-h-44 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2.5">
                        {data.products
                          .filter((p) => p.status === 'disponible' || p.status === 'rupture')
                          .map((p) => {
                            const checked = lProductIds.includes(p.id);
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-2 text-xs py-1"
                              >
                                <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      const next = e.target.checked
                                        ? [...lProductIds, p.id]
                                        : lProductIds.filter((id) => id !== p.id);
                                      setLProductIds(next);
                                      if (!next.includes(lFeaturedProductId)) {
                                        setLFeaturedProductId(next[0] || '');
                                      }
                                    }}
                                  />
                                  <span className="truncate font-medium text-[#0B1528]">
                                    {p.name}
                                  </span>
                                  <span className="font-mono text-[11px] text-orange-600 shrink-0">
                                    {formatFCFA(p.promoPrice ?? p.price)}
                                  </span>
                                </label>
                                {checked && (
                                  <button
                                    type="button"
                                    onClick={() => setLFeaturedProductId(p.id)}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer shrink-0 ${
                                      lFeaturedProductId === p.id
                                        ? 'bg-orange-600 text-white'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {lFeaturedProductId === p.id ? 'En avant' : 'Mettre en avant'}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={creatingLive}
                    className="w-full py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {creatingLive ? 'Enregistrement...' : 'Programmer la session Live'}
                  </button>
                </form>

                {/* Liste et pilotage des diffusions */}
                <div className="lg:col-span-7 space-y-5">
                  <h2 className="font-display font-bold text-lg text-[#0B1528]">
                    Vos diffusions ({data.lives.length})
                  </h2>
                  {data.lives.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
                      Aucune diffusion programmée pour le moment.
                    </div>
                  ) : (
                    data.lives.map((live) => {
                      const fullLiveUrl = `${window.location.origin}/live/${live.slug}`;
                      const youtubeInput =
                        liveYoutubeDrafts[live.id] ?? (live.youtubeUrl || live.streamUrl || '');
                      const liveProducts = live.productIds
                        .map((pid) => data.products.find((p) => p.id === pid))
                        .filter((p): p is Product => Boolean(p));
                      const availableToAdd = data.products.filter(
                        (p) =>
                          (p.status === 'disponible' || p.status === 'rupture') &&
                          !live.productIds.includes(p.id),
                      );
                      const isBusy = savingLiveId === live.id;

                      return (
                        <div
                          key={live.id}
                          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                        >
                          {/* Header */}
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex gap-3 min-w-0">
                              <div className="w-24 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                                <SafeImage
                                  src={live.coverUrl}
                                  alt={live.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-xs mb-1">
                                  <span
                                    className={`px-2 py-0.5 rounded font-semibold ${
                                      live.status === 'en_direct'
                                        ? 'bg-orange-600 text-white'
                                        : live.status === 'en_preparation'
                                          ? 'bg-amber-100 text-amber-800'
                                          : live.status === 'annule'
                                            ? 'bg-red-100 text-red-700'
                                            : live.status === 'termine'
                                              ? 'bg-slate-200 text-slate-700'
                                              : 'bg-[#0B1528] text-white'
                                    }`}
                                  >
                                    {LIVE_STATUS_LABELS[live.status]}
                                  </span>
                                  <span className="text-slate-500">{live.category}</span>
                                  {live.moderatedHidden && (
                                    <span className="text-red-600 font-semibold">
                                      Suspendu par l’administration
                                    </span>
                                  )}
                                </div>
                                <h3 className="font-display font-bold text-base text-[#0B1528] truncate">
                                  {live.title}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                  Prévu le {new Date(live.scheduledAt).toLocaleString('fr-FR')}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => navigate(`/live/${live.slug}`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-[#0B1528] cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Salle live</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteLiveTarget(live)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                                aria-label="Supprimer le live"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Lien YouTube Live */}
                          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#0B1528] flex items-center gap-1.5">
                                <Youtube className="w-4 h-4 text-orange-600" />
                                <span>Lien YouTube Live</span>
                              </span>
                              {live.youtubeVideoId ? (
                                <span className="text-[11px] font-mono text-emerald-700">
                                  ID validé : {live.youtubeVideoId}
                                </span>
                              ) : (
                                <span className="text-[11px] text-amber-700 font-medium">
                                  Lien YouTube requis pour confirmer le direct
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="url"
                                value={youtubeInput}
                                onChange={(e) =>
                                  setLiveYoutubeDrafts((p) => ({ ...p, [live.id]: e.target.value }))
                                }
                                placeholder="https://www.youtube.com/watch?v=... ou https://youtube.com/live/..."
                                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                              />
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleAttachLiveYouTube(live.id)}
                                className="px-3.5 py-1.5 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                              >
                                Enregistrer le lien
                              </button>
                            </div>
                          </div>

                          {/* Pilotage explicite des statuts */}
                          <div className="flex flex-wrap items-center gap-2">
                            {live.status !== 'en_preparation' && live.status !== 'en_direct' && live.status !== 'termine' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleLiveStatusChange(live, 'en_preparation')}
                                className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-semibold cursor-pointer"
                              >
                                Passer en préparation
                              </button>
                            )}
                            {live.status !== 'en_direct' && live.status !== 'termine' && live.status !== 'annule' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleLiveStatusChange(live, 'en_direct')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                <Radio className="w-3.5 h-3.5" />
                                <span>Confirmer EN DIRECT</span>
                              </button>
                            )}
                            {live.status === 'en_direct' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleLiveStatusChange(live, 'termine')}
                                className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                Terminer le live
                              </button>
                            )}
                            {live.status !== 'termine' && live.status !== 'annule' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleLiveStatusChange(live, 'annule')}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                              >
                                Annuler
                              </button>
                            )}
                          </div>

                          {/* Gestion des produits pendant le live (ordre + mise en avant + ajout/retrait) */}
                          <div className="border-t border-slate-100 pt-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-[#0B1528]">
                                Produits présentés ({liveProducts.length})
                              </p>
                              {availableToAdd.length > 0 && (
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      void handleToggleLiveProduct(live, e.target.value);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white max-w-[200px]"
                                >
                                  <option value="">+ Ajouter un produit...</option>
                                  {availableToAdd.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {liveProducts.length === 0 ? (
                              <p className="text-xs text-slate-400">
                                Aucun produit sélectionné pour ce live.
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {liveProducts.map((p, idx) => {
                                  const isFeatured = live.featuredProductId === p.id;
                                  return (
                                    <div
                                      key={p.id}
                                      className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs ${
                                        isFeatured
                                          ? 'bg-orange-50/70 border-orange-300'
                                          : 'bg-slate-50 border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-mono text-[11px] text-slate-400 w-4">
                                          {idx + 1}.
                                        </span>
                                        <span className="truncate font-medium text-[#0B1528]">
                                          {p.name}
                                        </span>
                                        <span className="font-mono text-[11px] text-orange-600 shrink-0">
                                          {formatFCFA(p.promoPrice ?? p.price)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => void handleSpotlightLiveProduct(live, p.id)}
                                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                                            isFeatured
                                              ? 'bg-orange-600 text-white'
                                              : 'bg-white border border-slate-200 text-slate-700'
                                          }`}
                                          title="Mettre en avant pendant le live"
                                        >
                                          <Sparkles className="w-3 h-3" />
                                          <span>{isFeatured ? 'En avant' : 'Épingler'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => void handleMoveLiveProduct(live, idx, -1)}
                                          className="p-1 rounded border border-slate-200 bg-white disabled:opacity-35 cursor-pointer"
                                          aria-label="Monter"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === liveProducts.length - 1}
                                          onClick={() => void handleMoveLiveProduct(live, idx, 1)}
                                          className="p-1 rounded border border-slate-200 bg-white disabled:opacity-35 cursor-pointer"
                                          aria-label="Descendre"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleToggleLiveProduct(live, p.id)}
                                          className="p-1 rounded border border-red-200 text-red-600 bg-white cursor-pointer"
                                          aria-label="Retirer du live"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Partage */}
                          <div className="border-t border-slate-100 pt-3">
                            <SocialShareBar
                              url={fullLiveUrl}
                              shareText={`Rejoignez mon Live Shopping « ${live.title} » sur TECH STYLE MARKET :`}
                              label="Partager ce live"
                              compact
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 11. PARAMÈTRES */}
          {tab === 'parametres' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h2 className="font-display font-bold text-lg text-[#0B1528]">
                  Lien public et partage de votre boutique
                </h2>
                <p className="text-xs text-slate-600">
                  Partagez l’adresse officielle de votre boutique avec vos clients sur WhatsApp, Facebook
                  ou par message direct.
                </p>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-[#0B1528] break-all">
                  {publicShopUrl}
                </div>
                <SocialShareBar
                  url={publicShopUrl}
                  shareText={`Visitez ma boutique "${shop.name}" sur TECH STYLE MARKET :`}
                  label="Partager ma boutique"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-bold text-base text-[#0B1528]">
                    Compte utilisateur &amp; sécurité
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Modifiez votre photo personnelle, votre mot de passe ou gérez votre espace client
                    depuis le même compte unifié.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('/profil')}
                    className="px-4 py-2 rounded-lg bg-[#0B1528] text-white text-xs font-semibold cursor-pointer"
                  >
                    Mon profil &amp; mot de passe
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/espace-client')}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-[#0B1528] cursor-pointer"
                  >
                    Espace client
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (React UI, no window.confirm) */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-[#060D1A]/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display font-bold text-lg text-[#0B1528]">
              Confirmer la suppression
            </h3>
            <p className="text-sm text-slate-600">
              Voulez-vous supprimer définitivement le produit{' '}
              <span className="font-semibold text-[#0B1528]">« {deleteTarget.name} »</span> ? Cette
              action est irréversible. Si vous souhaitez le masquer temporairement, utilisez plutôt
              l’option Archiver.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteProduct()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Live Confirmation Modal */}
      {deleteLiveTarget && (
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
              Voulez-vous supprimer définitivement la session{' '}
              <span className="font-semibold text-[#0B1528]">« {deleteLiveTarget.title} »</span> ?
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteLiveTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteLive()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
              >
                Supprimer le live
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
