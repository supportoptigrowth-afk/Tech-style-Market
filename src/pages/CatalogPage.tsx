import { Filter, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NIGER_CITIES } from '../constants';
import { useApp } from '../context/AppContext';
import { fetchPublicCatalog, fetchPublicStores } from '../lib/firestoreService';
import type { ProductWithShop, Shop } from '../types';
import { ProductCard } from '../components/ProductCard';

export function CatalogPage() {
  const { path, categories } = useApp();
  const initialParams = new URLSearchParams(path.split('?')[1] || '');

  const [q, setQ] = useState(initialParams.get('q') || '');
  const [category, setCategory] = useState(initialParams.get('category') || 'Toutes');
  const [city, setCity] = useState(initialParams.get('city') || 'Toutes');
  const [shopId, setShopId] = useState(initialParams.get('shopId') || 'Toutes');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('recent');
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicStores().then(setShops).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(path.split('?')[1] || '');
    if (params.has('q')) setQ(params.get('q') || '');
    if (params.has('category')) setCategory(params.get('category') || 'Toutes');
    if (params.has('shopId')) setShopId(params.get('shopId') || 'Toutes');
  }, [path]);

  useEffect(() => {
    setLoading(true);
    fetchPublicCatalog({
      q,
      category,
      city,
      shopId,
      inStockOnly,
      promoOnly,
      minPrice: minPrice ? Number(minPrice) : 0,
      maxPrice: maxPrice ? Number(maxPrice) : 0,
      sort,
    })
      .then((res) => setProducts(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [q, category, city, shopId, minPrice, maxPrice, promoOnly, inStockOnly, sort]);

  const resetFilters = () => {
    setQ('');
    setCategory('Toutes');
    setCity('Toutes');
    setShopId('Toutes');
    setMinPrice('');
    setMaxPrice('');
    setPromoOnly(false);
    setInStockOnly(false);
    setSort('recent');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-[#0B1528]">Catalogue des produits</h1>
        <p className="text-sm text-slate-600 mt-1">
          Recherchez et filtrez par catégorie, boutique, ville, disponibilité et budget en FCFA.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom du produit, boutique ou référence..."
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filtrer par catégorie"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-orange-600"
            >
              <option value="Toutes">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              aria-label="Filtrer par boutique"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-orange-600"
            >
              <option value="Toutes">Toutes les boutiques</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              aria-label="Filtrer par ville"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-orange-600"
            >
              <option value="Toutes">Toutes les villes</option>
              {NIGER_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-1">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Trier les résultats"
              className="w-full px-2 py-2.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-orange-600"
            >
              <option value="recent">Récents</option>
              <option value="popular">Populaires</option>
              <option value="price_asc">Prix ↑</option>
              <option value="price_desc">Prix ↓</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Filter className="w-3.5 h-3.5" />
              <span>Prix (FCFA) :</span>
            </div>
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              placeholder="Min"
              className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
            />
            <span className="text-slate-400 text-xs">à</span>
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Max"
              className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
            />

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-600"
              />
              <span>En stock uniquement</span>
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={promoOnly}
                onChange={(e) => setPromoOnly(e.target.checked)}
                className="rounded border-slate-300 text-orange-600 focus:ring-orange-600"
              />
              <span>En promotion</span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {products.length} résultat{products.length > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-orange-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="h-80 rounded-xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="font-display font-semibold text-lg text-[#0B1528] mb-2">
            Aucun produit ne correspond à votre recherche
          </p>
          <p className="text-sm text-slate-600 mb-6">
            Essayez de modifier vos filtres ou d’élargir la recherche à toutes les villes.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Afficher tout le catalogue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
