import { Heart, MessageCircle, ShoppingBag } from 'lucide-react';
import { buildWhatsappOrderUrl, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import type { ProductWithShop } from '../types';
import { SafeImage } from './SafeImage';

export function ProductCard({ product }: { product: ProductWithShop }) {
  const { navigate, addToCart, toggleFavorite, user } = useApp();
  const isFav = Boolean(user?.favorites.includes(product.id));
  const activePrice =
    product.promoPrice && product.promoPrice < product.price ? product.promoPrice : product.price;
  const hasPromo = Boolean(product.promoPrice && product.promoPrice < product.price);
  const inStock = product.stock > 0 && product.status === 'disponible';

  const productUrl = `${window.location.origin}/produit/${product.id}`;
  const wa = buildWhatsappOrderUrl({
    whatsappNumber: product.shop?.whatsappNumber,
    productName: product.name,
    price: activePrice,
    reference: product.reference,
    productUrl,
  });

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <button
          type="button"
          onClick={() => navigate(`/produit/${product.id}`)}
          className="w-full h-full block text-left cursor-pointer"
          aria-label={`Voir ${product.name}`}
        >
          <SafeImage
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void toggleFavorite(product.id);
          }}
          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`absolute top-3 right-3 w-9 h-9 rounded-lg flex items-center justify-center border transition-colors cursor-pointer ${
            isFav
              ? 'bg-orange-600 text-white border-orange-600'
              : 'bg-white/95 text-slate-700 border-slate-200 hover:text-orange-600'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>

        {hasPromo && (
          <div className="absolute top-3 left-3 bg-[#0B1528] text-white text-xs font-semibold px-2.5 py-1 rounded-md">
            Offre spéciale
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 gap-2.5">
        {/* Zero-pill clean metadata line */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
          <span className="truncate">{product.category}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{product.city}</span>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/produit/${product.id}`)}
          className="text-left font-display font-semibold text-slate-900 text-base leading-snug line-clamp-2 hover:text-orange-600 transition-colors cursor-pointer"
        >
          {product.name}
        </button>

        {product.shop && (
          <button
            type="button"
            onClick={() => navigate(`/boutique/${product.shop!.slug}`)}
            className="text-left text-xs text-slate-500 hover:text-[#0B1528] transition-colors truncate cursor-pointer"
          >
            Boutique : <span className="font-medium text-slate-700">{product.shop.name}</span>
          </button>
        )}

        <div className="mt-auto pt-2 border-t border-slate-100">
          <div className="flex items-baseline justify-between gap-2 mb-3">
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-semibold text-base text-[#0B1528] tabular-nums">
                {formatFCFA(activePrice)}
              </span>
              {hasPromo && (
                <span className="font-mono text-xs text-slate-400 line-through tabular-nums">
                  {formatFCFA(product.price)}
                </span>
              )}
            </div>
            <span
              className={`text-xs font-medium ${
                inStock ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {inStock ? `En stock (${product.stock})` : 'Rupture'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!inStock}
              onClick={() => addToCart(product.id, 1)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#0B1528] text-white hover:bg-[#132342] disabled:bg-slate-200 disabled:text-slate-500 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0" />
              <span>Panier</span>
            </button>

            <a
              href={wa.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
