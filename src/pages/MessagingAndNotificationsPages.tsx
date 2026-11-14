import { Bell, CheckCheck, MessageSquare, Send } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  sendDirectMessageDoc,
  subscribeConversations,
  subscribeUserMessages,
} from '../lib/firestoreService';
import type { DirectMessage, MessageThread } from '../types';

export function MessagingPage() {
  const { user, navigate, showToast } = useApp();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>('');
  const [allMessages, setAllMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    const unsubThreads = subscribeConversations(user.id, (list) => {
      setThreads(list);
      setActiveThreadId((prev) => prev || (list[0]?.id ?? ''));
      setLoading(false);
    });
    const unsubMessages = subscribeUserMessages(user.id, (list) => {
      setAllMessages(list);
    });
    return () => {
      unsubThreads();
      unsubMessages();
    };
  }, [user]);

  const messages = useMemo(
    () => allMessages.filter((m) => m.threadId === activeThreadId),
    [allMessages, activeThreadId],
  );

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <p className="text-sm text-slate-600 mb-4">Connectez-vous pour accéder à la messagerie.</p>
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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !text.trim()) return;
    try {
      await sendDirectMessageDoc({
        sender: user,
        threadId: activeThreadId,
        text: text.trim(),
      });
      setText('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur d’envoi.', 'error');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-display font-bold text-3xl text-[#0B1528] mb-2">Messagerie</h1>
      <p className="text-sm text-slate-600 mb-6">
        Échangez directement en temps réel avec les vendeurs et clients.
      </p>

      {loading ? (
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse" />
      ) : threads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600 mb-4">
            Vous n’avez pas encore de conversation. Visitez un produit ou une boutique pour contacter un vendeur.
          </p>
          <button
            type="button"
            onClick={() => navigate('/catalogue')}
            className="px-5 py-2.5 rounded-lg bg-[#0B1528] text-white text-sm font-semibold cursor-pointer"
          >
            Parcourir le catalogue
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
          <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-slate-200 divide-y divide-slate-100">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveThreadId(t.id)}
                className={`w-full text-left p-4 transition-colors cursor-pointer ${
                  t.id === activeThreadId ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-display font-semibold text-sm text-[#0B1528] truncate">
                    {user.id === t.clientId ? t.shopName : t.clientName}
                  </span>
                  {(t.unreadCount ?? 0) > 0 && (
                    <span className="font-mono text-xs font-bold text-orange-600">
                      ({t.unreadCount})
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-1">{t.lastMessage}</p>
              </button>
            ))}
          </div>

          <div className="md:col-span-8 flex flex-col">
            <div className="flex-1 p-5 space-y-3 overflow-y-auto max-h-[440px]">
              {messages.map((m) => {
                const mine = m.senderId === user.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[78%] rounded-xl px-4 py-2.5 text-sm ${
                        mine
                          ? 'bg-[#0B1528] text-white'
                          : 'bg-slate-100 text-slate-900 border border-slate-200'
                      }`}
                    >
                      <p className="text-[11px] opacity-75 mb-0.5">{m.senderName}</p>
                      <p>{m.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Écrire votre message..."
                className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold cursor-pointer"
                aria-label="Envoyer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { user, notifications, markAllNotificationsRead, navigate } = useApp();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-14 text-center">
        <p className="text-sm text-slate-600 mb-4">Connectez-vous pour voir vos notifications.</p>
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-bold text-3xl text-[#0B1528]">Notifications</h1>
          <p className="text-sm text-slate-600 mt-1">
            Alertes de commandes, messages, lives des boutiques suivies et mises à jour.
          </p>
        </div>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={() => void markAllNotificationsRead()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-[#0B1528] hover:bg-slate-100 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Tout marquer comme lu</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">Aucune notification pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => navigate(n.link || '/espace-client')}
              className={`w-full text-left p-5 rounded-xl border transition-colors cursor-pointer ${
                n.read
                  ? 'bg-white border-slate-200'
                  : 'bg-orange-50/40 border-orange-300'
              }`}
            >
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-display font-semibold text-sm text-[#0B1528]">{n.title}</span>
                <span className="text-xs text-slate-400">
                  {new Date(n.createdAt).toLocaleString('fr-FR')}
                </span>
              </div>
              <p className="text-sm text-slate-600">{n.message}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
