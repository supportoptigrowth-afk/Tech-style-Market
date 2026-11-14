import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Radio,
  Search,
  ShoppingBag,
  Store,
  Video,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { LIVE_STATUS_LABELS, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import {
  fetchPublicCatalog,
  fetchPublicLives,
  fetchPublicStoresWithStats,
} from '../lib/firestoreService';
import type { LiveSession, ProductWithShop, Shop } from '../types';
import { ProductCard } from '../components/ProductCard';
import { SafeImage } from '../components/SafeImage';

export function HomePage() {
  const { navigate, categories, user } = useApp();
  const [products, setProducts] = useState<ProductWithShop[]>([]);
  const [shops, setShops] = useState<Array<Shop & { productCount?: number }>>([]);
  const [lives, setLives] = useState<LiveSession[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'populaires' | 'nouveaux' | 'promotions'>('populaires');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchPublicCatalog(), fetchPublicStoresWithStats(), fetchPublicLives()])
      .then(([prodList, shopList, liveList]) => {
        if (!mounted) return;
        setProducts(prodList);
        setShops(shopList);
        setLives(liveList);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const searchSuggestions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [products, searchTerm]);

  const displayedProducts = useMemo(() => {
    if (activeTab === 'promotions') {
      return products.filter((p) => p.promoPrice && p.promoPrice < p.price).slice(0, 6);
    }
    if (activeTab === 'nouveaux') {
      return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    }
    return [...products]
      .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || b.salesCount - a.salesCount)
      .slice(0, 6);
  }, [activeTab, products]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    navigate(q ? `/catalogue?q=${encodeURIComponent(q)}` : '/catalogue');
  };

  return (
    <div>
      {/* Hero + Smart Search */}
      <section className="bg-[#0B1528] text-white border-b border-[#1D345E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs font-medium text-orange-400 tracking-wide mb-3">
                Marketplace multi-vendeurs · Niamey &amp; International · Devise FCFA
              </p>
              <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl leading-[1.12] tracking-tight text-white [text-wrap:balance] mb-5">
                Achetez et vendez en toute confiance sur TECH STYLE MARKET
              </h1>
              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mb-8">
                Commandez directement avec paiement à la livraison ou discutez instantanément sur
                WhatsApp avec des boutiques vérifiées au Niger.
              </p>

              {/* Smart Search Bar */}
              <div className="relative max-w-2xl mb-8">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex flex-col sm:flex-row gap-2 bg-white p-1.5 rounded-xl shadow-lg"
                >
                  <div className="flex-1 flex items-center gap-2.5 px-3">
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <input
                      type="search"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher un téléphone, vêtement, référence TSM..."
                      className="w-full py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent"
                      aria-label="Barre de recherche intelligente"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Rechercher
                  </button>
                </form>

                {searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-2 bg-white text-slate-900 rounded-xl shadow-xl border border-slate-200 overflow-hidden z-30">
                    {searchSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigate(`/produit/${item.id}`)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 text-left cursor-pointer"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.category} · {item.reference}
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-orange-600 shrink-0 tabular-nums">
                          {formatFCFA(item.promoPrice ?? item.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/catalogue')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white text-[#0B1528] hover:bg-slate-100 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <span>Explorer le catalogue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(user?.roles.includes('vendor') ? '/espace-vendeur' : '/creer-boutique')}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-600 text-white hover:border-orange-500 hover:text-orange-400 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Store className="w-4 h-4" />
                  <span>{user?.roles.includes('vendor') ? 'Gérer ma boutique' : 'Devenir vendeur'}</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[280px] rounded-xl overflow-hidden border border-[#1D345E] bg-[#132342] relative">
                <SafeImage
                  src="/src/assets/images/hero_tech_market_1794611250879.jpg"
                  alt="Sélection High-Tech et Lifestyle TECH STYLE MARKET"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#060D1A]/85 via-[#060D1A]/20 to-transparent flex flex-col justify-end p-6">
                  <p className="text-xs text-orange-400 font-medium mb-1">
                    Achat direct &amp; Commande WhatsApp
                  </p>
                  <p className="font-display font-semibold text-white text-lg">
                    Livraison à Niamey, Maradi, Zinder et dans tout le Niger
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-bold text-2xl text-[#0B1528]">Catégories</h2>
            <p className="text-sm text-slate-600 mt-1">
              Parcourez les 10 univers de produits disponibles sur la plateforme.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/catalogue')}
            className="text-sm font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap cursor-pointer"
          >
            Tout voir →
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => navigate(`/catalogue?category=${encodeURIComponent(cat.name)}`)}
              className="text-left p-4 rounded-xl bg-white border border-slate-200 hover:border-orange-500 hover:shadow-sm transition-all cursor-pointer"
            >
              <p className="font-display font-semibold text-sm text-[#0B1528] mb-1">
                {cat.name}
              </p>
              <p className="text-xs text-slate-500 line-clamp-2">{cat.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Featured / New / Promo Products (Single clean tabbed showcase) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-bold text-2xl text-[#0B1528]">Sélection du marché</h2>
            <p className="text-sm text-slate-600 mt-1">
              Produits publiés par les commerçants inscrits sur TECH STYLE MARKET.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
            {(
              [
                { key: 'populaires', label: 'Populaires' },
                { key: 'nouveaux', label: 'Nouveautés' },
                { key: 'promotions', label: 'Promotions' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.key
                    ? 'bg-white text-[#0B1528] shadow-sm'
                    : 'text-slate-600 hover:text-[#0B1528]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-80 rounded-xl bg-slate-200 animate-pulse" />
            ))}
          </div>
        ) : displayedProducts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="text-sm text-slate-600 mb-4">
              Aucun produit en promotion pour le moment.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('populaires')}
              className="px-4 py-2 bg-[#0B1528] text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Voir les produits populaires
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Popular Shops & Live Shopping */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Boutiques populaires */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-display font-bold text-xl text-[#0B1528]">
                  Boutiques vérifiées
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Commerçants actifs et pages publiques dédiées
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/boutiques')}
                className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
              >
                Toutes les boutiques →
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {shops.slice(0, 3).map((shop) => (
                <div
                  key={shop.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      <SafeImage
                        src={shop.logoUrl}
                        alt={shop.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-semibold text-sm text-[#0B1528] truncate">
                          {shop.name}
                        </h3>
                        {shop.verifiedStatus === 'verified' && (
                          <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span>{shop.city}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{shop.productCount ?? 0} produits</span>
                      </p>
                      <p className="text-xs text-slate-600 line-clamp-1 mt-1">{shop.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/boutique/${shop.slug}`)}
                    className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-[#0B1528] hover:text-white text-xs font-semibold text-[#0B1528] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Visiter
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Live Shopping Spotlight */}
          <div className="lg:col-span-5 bg-[#0B1528] text-white rounded-xl overflow-hidden border border-[#1D345E] flex flex-col">
            <div className="relative h-48 bg-[#132342]">
              <SafeImage
                src="/src/assets/images/live_shopping_studio_1794611253260.jpg"
                alt="Live Shopping TECH STYLE MARKET"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1528] via-[#0B1528]/30 to-transparent" />
            </div>
            <div className="p-6 flex flex-col flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-400 mb-2">
                <Radio className="w-4 h-4" />
                <span>Live Shopping interactif</span>
              </div>
              <h2 className="font-display font-bold text-xl text-white mb-2">
                Ventes en direct avec les commerçants
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-5">
                Regardez la présentation des articles en temps réel, posez vos questions dans le
                chat et commandez directement pendant la session.
              </p>

              <div className="space-y-2.5 mb-6 flex-1">
                {lives
                  .filter((l) => l.status !== 'annule')
                  .slice(0, 2)
                  .map((live) => (
                    <button
                      key={live.id}
                      type="button"
                      onClick={() => navigate(`/live/${live.slug}`)}
                      className="w-full text-left p-3 rounded-lg bg-[#132342] hover:bg-[#1D345E] border border-[#1D345E] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-1">
                        <span className="font-medium text-orange-400">{live.shopName}</span>
                        <span className="text-slate-300">
                          {live.status === 'en_direct' ? 'EN DIRECT' : LIVE_STATUS_LABELS[live.status]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-white line-clamp-1">{live.title}</p>
                    </button>
                  ))}
              </div>

              <button
                type="button"
                onClick={() => navigate('/live')}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <Video className="w-4 h-4" />
                <span>Accéder au Live Shopping</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-white border-t border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display font-bold text-2xl text-[#0B1528]">
              Comment fonctionne TECH STYLE MARKET ?
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Une plateforme pensée pour la simplicité d’achat et la croissance des commerçants.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <p className="font-mono text-xs font-semibold text-orange-600 mb-2">01.</p>
              <h3 className="font-display font-semibold text-base text-[#0B1528] mb-2">
                Choisissez votre mode d’achat
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Ajoutez vos articles au panier et validez avec paiement à la livraison, ou cliquez
                sur « Commander sur WhatsApp » avec message prérempli.
              </p>
            </div>

            <div>
              <p className="font-mono text-xs font-semibold text-orange-600 mb-2">02.</p>
              <h3 className="font-display font-semibold text-base text-[#0B1528] mb-2">
                Ouvrez votre boutique en quelques minutes
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Créez votre boutique avec lien personnalisé, publiez vos produits en FCFA, gérez
                vos stocks et suivez vos commandes depuis votre espace vendeur.
              </p>
            </div>

            <div>
              <p className="font-mono text-xs font-semibold text-orange-600 mb-2">03.</p>
              <h3 className="font-display font-semibold text-base text-[#0B1528] mb-2">
                Vendez en direct avec le Live Shopping
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Programmez une diffusion, partagez le lien unique sur WhatsApp et Facebook, et
                répondez aux questions des acheteurs en temps réel.
              </p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-orange-600 shrink-0" />
              <p className="text-sm font-medium text-slate-800">
                Vous êtes commerçant ou créateur au Niger ? Lancez votre boutique dès aujourd’hui.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/creer-boutique')}
              className="px-5 py-2.5 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-sm font-semibold whitespace-nowrap cursor-pointer"
            >
              Créer ma boutique
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
