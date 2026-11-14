import { ArrowLeft, CheckCircle2, MessageCircle, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  OFFICIAL_WHATSAPP_RAW,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  formatFCFA,
  normalizeWhatsappNumber,
} from '../constants';
import { useApp } from '../context/AppContext';
import {
  cancelOrderTransaction,
  fetchCustomerOrders,
  fetchOrderById,
} from '../lib/firestoreService';
import type { SubOrder } from '../types';
import { SafeImage } from '../components/SafeImage';

export function OrdersHistoryPage() {
  const { user, navigate } = useApp();
  const [orders, setOrders] = useState<SubOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchCustomerOrders(user.id)
      .then((res) => setOrders(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <p className="text-sm text-slate-600 mb-4">Connectez-vous pour consulter vos commandes.</p>
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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-2">
        Historique des commandes
      </h1>
      <p className="text-sm text-slate-600 mb-8">
        Suivez chaque sous-commande par boutique en temps réel.
      </p>

      {loading ? (
        <div className="h-48 bg-slate-200 rounded-xl animate-pulse" />
      ) : orders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-4">Vous n’avez pas encore passé de commande.</p>
          <button
            type="button"
            onClick={() => navigate('/catalogue')}
            className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Explorer le catalogue
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-16 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <SafeImage
                    src={order.items[0]?.imageUrl}
                    alt={order.items[0]?.name || order.shopName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-mono font-semibold text-[#0B1528]">{order.orderNumber}</span>
                    <span>·</span>
                    <span>Lot {order.globalOrderNumber}</span>
                    <span>·</span>
                    <span>{new Date(order.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                  <p className="font-display font-semibold text-base text-[#0B1528]">
                    {order.shopName}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                    {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Livraison : {order.deliveryAddress}, {order.customerCity}
                  </p>
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                <span className="font-mono font-bold text-base text-[#0B1528] tabular-nums">
                  {formatFCFA(order.subtotal)}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    order.status === 'annulee'
                      ? 'text-red-600'
                      : order.status === 'livree'
                        ? 'text-emerald-700'
                        : 'text-orange-600'
                  }`}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/commande/${order.id}`)}
                  className="text-xs font-semibold text-[#0B1528] hover:text-orange-600 cursor-pointer"
                >
                  Détails et suivi →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const { navigate, showToast, user } = useApp();
  const [order, setOrder] = useState<SubOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrderById(orderId)
      .then((res) => setOrder(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Commande introuvable.'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const handleCancel = async () => {
    if (!order) return;
    try {
      const updated = await cancelOrderTransaction(order.id);
      setOrder(updated);
      showToast('Commande annulée.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Impossible d’annuler.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="h-64 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-sm text-red-600 mb-4">{error || 'Commande introuvable.'}</p>
        <button
          type="button"
          onClick={() => navigate('/historique-commandes')}
          className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
        >
          Retour aux commandes
        </button>
      </div>
    );
  }

  const currentIdx = ORDER_STATUS_FLOW.indexOf(order.status);
  const waNum = order.shopWhatsapp ? normalizeWhatsappNumber(order.shopWhatsapp) : OFFICIAL_WHATSAPP_RAW;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button
        type="button"
        onClick={() => navigate('/historique-commandes')}
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#0B1528] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Retour à mes commandes</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="font-mono text-xs text-slate-500">
              Réf. commande : {order.orderNumber} · Lot {order.globalOrderNumber}
            </p>
            <h1 className="font-display font-bold text-2xl text-[#0B1528] mt-1">
              {order.shopName}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Passée le {new Date(order.createdAt).toLocaleString('fr-FR')}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="font-mono font-bold text-xl text-[#0B1528] tabular-nums block">
              {formatFCFA(order.subtotal)}
            </span>
            <span
              className={`text-xs font-semibold ${
                order.status === 'annulee'
                  ? 'text-red-600'
                  : order.status === 'livree'
                    ? 'text-emerald-700'
                    : 'text-orange-600'
              }`}
            >
              Statut : {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
        </div>

        {/* Status Timeline */}
        {order.status !== 'annulee' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 py-2">
            {ORDER_STATUS_FLOW.map((st, idx) => {
              const reached = idx <= currentIdx;
              return (
                <div
                  key={st}
                  className={`p-3 rounded-lg border text-xs ${
                    reached
                      ? 'border-orange-500 bg-orange-50/50 text-[#0B1528] font-semibold'
                      : 'border-slate-200 bg-slate-50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2
                      className={`w-3.5 h-3.5 ${reached ? 'text-orange-600' : 'text-slate-300'}`}
                    />
                    <span className="font-mono text-[11px]">0{idx + 1}</span>
                  </div>
                  <span>{ORDER_STATUS_LABELS[st]}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Items */}
        <div className="space-y-3">
          <h2 className="font-display font-semibold text-sm text-[#0B1528]">Articles commandés</h2>
          {order.items.map((item) => (
            <div
              key={item.productId}
              className="flex items-center justify-between gap-4 p-3 rounded-lg border border-slate-100 bg-slate-50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-md overflow-hidden bg-white border border-slate-200 shrink-0">
                  <SafeImage src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0B1528] truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 font-mono">
                    {item.quantity} × {formatFCFA(item.unitPrice)} · Réf {item.reference}
                  </p>
                </div>
              </div>
              <span className="font-mono font-semibold text-sm text-[#0B1528] tabular-nums shrink-0">
                {formatFCFA(item.lineTotal)}
              </span>
            </div>
          ))}

          <div className="pt-2 border-t border-slate-100 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Sous-total articles</span>
              <span className="font-mono tabular-nums">
                {formatFCFA(order.itemsSubtotal ?? order.subtotal - (order.deliveryFee || 0))}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Frais de livraison</span>
              <span className="font-mono tabular-nums">
                {order.deliveryFee && order.deliveryFee > 0
                  ? formatFCFA(order.deliveryFee)
                  : '0 FCFA'}
              </span>
            </div>
          </div>
        </div>

        {/* Delivery Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-sm">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <p className="font-semibold text-[#0B1528] text-xs mb-1">Adresse de livraison</p>
            <p>{order.customerName}</p>
            <p className="font-mono text-xs text-slate-600">{order.customerPhone}</p>
            <p className="text-xs text-slate-600">
              {order.deliveryAddress}, {order.customerCity}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
            <div>
              <p className="font-semibold text-[#0B1528] text-xs mb-1">Paiement &amp; Support</p>
              <p className="text-xs text-slate-600">Paiement à la livraison (FCFA)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${waNum}?text=${encodeURIComponent(
                  `Bonjour ${order.shopName}, concernant ma commande ${order.orderNumber} sur TECH STYLE MARKET.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Contacter la boutique</span>
              </a>

              {order.status === 'en_attente' && user?.id === order.clientId && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-3.5 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
                >
                  Annuler la commande
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
