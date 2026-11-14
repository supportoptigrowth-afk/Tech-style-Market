import {
  CheckCircle2,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { NIGER_CITIES, buildWhatsappOrderUrl, formatFCFA } from '../constants';
import { useApp } from '../context/AppContext';
import { fetchPublicCatalog, placeOrderTransaction } from '../lib/firestoreService';
import type { GlobalOrder, ProductWithShop, SubOrder } from '../types';
import { SafeImage } from '../components/SafeImage';

export function CartPage() {
  const { cart, updateCartQty, removeFromCart, navigate } = useApp();
  const [catalog, setCatalog] = useState<ProductWithShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicCatalog()
      .then((res) => setCatalog(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const resolvedItems = useMemo(() => {
    const map = new Map(catalog.map((p) => [p.id, p]));
    return cart
      .map((item) => {
        const product = map.get(item.productId);
        if (!product) return null;
        const unitPrice =
          product.promoPrice && product.promoPrice < product.price ? product.promoPrice : product.price;
        return { ...item, product, unitPrice, lineTotal: unitPrice * item.quantity };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, catalog]);

  const itemsSubtotal = useMemo(
    () => resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [resolvedItems],
  );

  const deliveryFeeTotal = useMemo(() => {
    const shopMap = new Map<string, number>();
    for (const item of resolvedItems) {
      if (!shopMap.has(item.product.shopId)) {
        shopMap.set(item.product.shopId, Number(item.product.shop?.deliveryFee || 0));
      }
    }
    return Array.from(shopMap.values()).reduce((sum, fee) => sum + fee, 0);
  }, [resolvedItems]);

  const totalAmount = itemsSubtotal + deliveryFeeTotal;

  const uniqueShops = useMemo(() => {
    const ids = new Set(resolvedItems.map((i) => i.product.shopId));
    return ids.size;
  }, [resolvedItems]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-2">Votre panier</h1>
      <p className="text-sm text-slate-600 mb-8">
        Vérifiez les quantités avant de finaliser votre commande avec paiement à la livraison.
      </p>

      {resolvedItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-display font-semibold text-lg text-[#0B1528] mb-2">
            Votre panier est vide
          </p>
          <p className="text-sm text-slate-600 mb-6">
            Parcourez notre catalogue pour ajouter des produits.
          </p>
          <button
            type="button"
            onClick={() => navigate('/catalogue')}
            className="px-6 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Découvrir le catalogue
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            {resolvedItems.map(({ product, quantity, unitPrice, lineTotal }) => {
              const wa = buildWhatsappOrderUrl({
                whatsappNumber: product.shop?.whatsappNumber,
                productName: product.name,
                price: unitPrice,
                reference: product.reference,
                productUrl: `${window.location.origin}/produit/${product.id}`,
                quantity,
              });
              return (
                <div
                  key={product.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4"
                >
                  <div className="w-full sm:w-28 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <SafeImage
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/produit/${product.id}`)}
                        className="text-left font-display font-semibold text-sm text-[#0B1528] hover:text-orange-600 cursor-pointer"
                      >
                        {product.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(product.id)}
                        className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        aria-label="Retirer du panier"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Boutique : {product.shop?.name || 'Vendeur'} · Réf : {product.reference}
                    </p>
                    <p className="text-xs text-slate-600 mt-1 font-mono tabular-nums">
                      Prix unitaire : {formatFCFA(unitPrice)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center border border-slate-200 rounded-lg">
                        <button
                          type="button"
                          onClick={() => updateCartQty(product.id, quantity - 1)}
                          className="p-1.5 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                          aria-label="Diminuer la quantité"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-xs font-mono font-semibold tabular-nums">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(product.id, Math.min(product.stock, quantity + 1))}
                          className="p-1.5 text-slate-600 hover:text-[#0B1528] cursor-pointer"
                          aria-label="Augmenter la quantité"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-4">
                        <a
                          href={wa.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:underline"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                        <span className="font-mono font-bold text-sm text-[#0B1528] tabular-nums">
                          {formatFCFA(lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-[#0B1528]">Récapitulatif</h2>
            <div className="space-y-2 text-sm border-b border-slate-100 pb-4">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total articles ({resolvedItems.reduce((a, b) => a + b.quantity, 0)})</span>
                <span className="font-mono tabular-nums">{formatFCFA(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Frais de livraison</span>
                <span className="font-mono tabular-nums">
                  {deliveryFeeTotal > 0 ? formatFCFA(deliveryFeeTotal) : '0 FCFA (selon zone)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Boutiques concernées</span>
                <span className="font-mono tabular-nums">{uniqueShops}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Mode de règlement</span>
                <span className="font-medium text-[#0B1528]">À la livraison</span>
              </div>
            </div>

            {uniqueShops > 1 && (
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                Votre panier contient des articles de {uniqueShops} vendeurs différents : des
                sous-commandes indépendantes seront créées automatiquement sous une référence
                globale.
              </p>
            )}

            <div className="flex justify-between items-baseline pt-1">
              <span className="font-display font-bold text-base text-[#0B1528]">Total final</span>
              <span className="font-mono font-bold text-xl text-orange-600 tabular-nums">
                {formatFCFA(totalAmount)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/commande')}
              className="w-full py-3 rounded-lg bg-[#0B1528] hover:bg-[#132342] text-white text-sm font-semibold cursor-pointer"
            >
              Passer la commande
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const { user, cart, clearCart, navigate, showToast } = useApp();
  const [catalog, setCatalog] = useState<ProductWithShop[]>([]);
  const [customerName, setCustomerName] = useState(user?.fullName || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [customerCity, setCustomerCity] = useState(user?.city || 'Niamey');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<{
    globalOrder: GlobalOrder;
    subOrders: SubOrder[];
  } | null>(null);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.fullName);
      setCustomerPhone((prev) => prev || user.phone);
      setCustomerCity((prev) => prev || user.city);
    }
  }, [user]);

  useEffect(() => {
    fetchPublicCatalog()
      .then((res) => setCatalog(res))
      .catch((err) => console.error(err));
  }, []);

  const items = useMemo(() => {
    const map = new Map(catalog.map((p) => [p.id, p]));
    return cart
      .map((c) => {
        const product = map.get(c.productId);
        if (!product) return null;
        const unitPrice =
          product.promoPrice && product.promoPrice < product.price ? product.promoPrice : product.price;
        return { ...c, product, unitPrice, lineTotal: unitPrice * c.quantity };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [cart, catalog]);

  const itemsSubtotal = useMemo(() => items.reduce((sum, i) => sum + i.lineTotal, 0), [items]);
  const deliveryFeeTotal = useMemo(() => {
    const shopMap = new Map<string, number>();
    for (const item of items) {
      if (!shopMap.has(item.product.shopId)) {
        shopMap.set(item.product.shopId, Number(item.product.shop?.deliveryFee || 0));
      }
    }
    return Array.from(shopMap.values()).reduce((sum, fee) => sum + fee, 0);
  }, [items]);
  const totalAmount = itemsSubtotal + deliveryFeeTotal;

  if (confirmed) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <h1 className="font-display font-bold text-2xl text-[#0B1528] mb-2">
            Commande confirmée ({confirmed.globalOrder.globalOrderNumber})
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Votre commande d’un montant de{' '}
            <span className="font-mono font-bold text-[#0B1528]">
              {formatFCFA(confirmed.globalOrder.totalAmount)}
            </span>{' '}
            (Paiement à la livraison) a été transmise aux vendeurs concernés.
          </p>

          <div className="text-left space-y-3 mb-8">
            {confirmed.subOrders.map((sub) => (
              <div key={sub.id} className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold text-orange-600">{sub.orderNumber}</p>
                  <p className="font-display font-semibold text-sm text-[#0B1528]">{sub.shopName}</p>
                  <p className="text-xs text-slate-500">{sub.items.length} article(s)</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-sm text-[#0B1528] tabular-nums">
                    {formatFCFA(sub.subtotal)}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(`/commande/${sub.id}`)}
                    className="text-xs font-semibold text-orange-600 hover:underline mt-1 cursor-pointer"
                  >
                    Suivre →
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/historique-commandes')}
              className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
            >
              Voir mes commandes
            </button>
            <button
              type="button"
              onClick={() => navigate('/catalogue')}
              className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold cursor-pointer"
            >
              Continuer mes achats
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <h1 className="font-display font-bold text-xl text-[#0B1528] mb-2">
            Connexion requise pour commander
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            Connectez-vous ou créez votre compte afin de suivre l’état de votre commande en temps réel.
          </p>
          <div className="flex gap-3 justify-center">
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
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await placeOrderTransaction({
        uid: user.id,
        items: cart,
        customerName,
        customerPhone,
        customerCity,
        deliveryAddress,
        notes,
      });
      clearCart();
      setConfirmed(res);
      showToast('Commande validée avec succès !', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la validation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-2">
        Validation de la commande
      </h1>
      <p className="text-sm text-slate-600 mb-8">
        Renseignez vos coordonnées de livraison. Les prix et stocks sont vérifiés sur le serveur
        avant confirmation.
      </p>

      {items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <p className="text-sm text-slate-600 mb-4">Votre panier est vide.</p>
          <button
            type="button"
            onClick={() => navigate('/catalogue')}
            className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Aller au catalogue
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <h2 className="font-display font-bold text-lg text-[#0B1528]">
              Adresse et coordonnées de livraison
            </h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nom complet du destinataire
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Téléphone (joignable à la livraison)
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Ville</label>
              <select
                value={customerCity}
                onChange={(e) => setCustomerCity(e.target.value)}
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
                Quartier et adresse précise
              </label>
              <input
                type="text"
                required
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Ex. Plateau, près de la station, porte 12..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Instructions complémentaires (optionnel)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Créneau horaire souhaité, point de repère..."
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg"
              />
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-display font-semibold text-sm text-[#0B1528]">
                Mode de paiement sélectionné : Paiement à la livraison
              </p>
              <p className="text-xs text-slate-600 mt-1">
                Vous réglez le montant exact en espèces ou Mobile Money au moment de la réception
                du colis.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="font-display font-bold text-lg text-[#0B1528]">Détails de la commande</h2>
            <div className="space-y-3 border-b border-slate-100 pb-4">
              {items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-10 rounded-md overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <SafeImage
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-[#0B1528] truncate">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.quantity} × {formatFCFA(item.unitPrice)} · {item.product.shop?.name}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-semibold text-slate-900 shrink-0 tabular-nums">
                    {formatFCFA(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-sm border-b border-slate-100 pb-3">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total articles</span>
                <span className="font-mono tabular-nums">{formatFCFA(itemsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Frais de livraison</span>
                <span className="font-mono tabular-nums">
                  {deliveryFeeTotal > 0 ? formatFCFA(deliveryFeeTotal) : '0 FCFA (à convenir)'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="font-display font-bold text-base text-[#0B1528]">
                Total à payer à la livraison
              </span>
              <span className="font-mono font-bold text-xl text-orange-600 tabular-nums">
                {formatFCFA(totalAmount)}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {submitting ? 'Validation en cours...' : 'Confirmer ma commande'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
