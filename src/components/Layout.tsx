import {
  Bell,
  Menu,
  MessageSquare,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  User as UserIcon,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { OFFICIAL_EMAIL, OFFICIAL_WHATSAPP_DISPLAY, OFFICIAL_WHATSAPP_RAW } from '../constants';
import { useApp } from '../context/AppContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const { path, navigate, user, cartCount, unreadNotifications, logout } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = quickSearch.trim();
    navigate(q ? `/catalogue?q=${encodeURIComponent(q)}` : '/catalogue');
    setMobileOpen(false);
  };

  const navLinkClass = (target: string) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer pb-0.5 ${
      path === target || (target !== '/' && path.startsWith(target))
        ? 'text-orange-600 border-b-2 border-orange-600'
        : 'text-slate-700 hover:text-[#0B1528]'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar: 3-Zone Contract */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
          {/* Zone 1: Single-element Brand Wordmark with TSM typographic logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 group"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#0B1528] text-white font-display font-extrabold text-sm tracking-tighter border border-[#1D345E] group-hover:bg-orange-600 transition-colors">
              TSM
            </span>
            <span className="font-display font-bold text-base sm:text-lg tracking-tight text-[#0B1528]">
              TECH STYLE MARKET
            </span>
          </a>

          {/* Zone 2: 4-5 Concise Single-Line Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Navigation principale">
            <button type="button" onClick={() => navigate('/catalogue')} className={navLinkClass('/catalogue')}>
              Catalogue
            </button>
            <button type="button" onClick={() => navigate('/boutiques')} className={navLinkClass('/boutiques')}>
              Boutiques
            </button>
            <button type="button" onClick={() => navigate('/live')} className={navLinkClass('/live')}>
              Live Shopping
            </button>
            <button
              type="button"
              onClick={() => navigate(user?.roles.includes('vendor') ? '/espace-vendeur' : '/creer-boutique')}
              className={navLinkClass(user?.roles.includes('vendor') ? '/espace-vendeur' : '/creer-boutique')}
            >
              {user?.roles.includes('vendor') ? 'Espace Vendeur' : 'Vendre'}
            </button>
            {user?.roles.includes('admin') && (
              <button type="button" onClick={() => navigate('/admin')} className={navLinkClass('/admin')}>
                Administration
              </button>
            )}
          </nav>

          {/* Zone 3: Actions (Cart + Auth / Account) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/catalogue')}
              className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#0B1528] transition-colors cursor-pointer"
              aria-label="Rechercher un produit"
              title="Rechercher"
            >
              <Search className="w-4 h-4" />
            </button>

            {user && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/messagerie')}
                  className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#0B1528] transition-colors cursor-pointer"
                  aria-label="Messagerie"
                  title="Messagerie"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/notifications')}
                  className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#0B1528] transition-colors cursor-pointer"
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] font-mono font-semibold flex items-center justify-center tabular-nums">
                      {unreadNotifications > 9 ? '9+' : unreadNotifications}
                    </span>
                  )}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => navigate('/panier')}
              className="relative inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-800 hover:border-[#0B1528] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Voir le panier"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Panier</span>
              <span className="font-mono tabular-nums text-orange-600">({cartCount})</span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigate('/espace-client')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0B1528] text-white hover:bg-[#132342] text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="max-w-[110px] truncate">{user.fullName.split(' ')[0]}</span>
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/connexion')}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-[#0B1528] hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/inscription')}
                  className="px-3.5 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Inscription
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-3">
            <form onSubmit={handleQuickSearch} className="flex gap-2">
              <input
                type="search"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Rechercher un produit ou une référence..."
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-orange-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#0B1528] text-white text-sm font-semibold rounded-lg"
              >
                OK
              </button>
            </form>
            <div className="grid grid-cols-2 gap-2 text-sm font-medium">
              <button
                type="button"
                onClick={() => {
                  navigate('/catalogue');
                  setMobileOpen(false);
                }}
                className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100"
              >
                Catalogue
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/boutiques');
                  setMobileOpen(false);
                }}
                className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100"
              >
                Boutiques
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/live');
                  setMobileOpen(false);
                }}
                className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100"
              >
                Live Shopping
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate(user?.roles.includes('vendor') ? '/espace-vendeur' : '/creer-boutique');
                  setMobileOpen(false);
                }}
                className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100"
              >
                {user?.roles.includes('vendor') ? 'Espace Vendeur' : 'Devenir vendeur'}
              </button>
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/espace-client');
                      setMobileOpen(false);
                    }}
                    className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100"
                  >
                    Mon espace client
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/messagerie');
                      setMobileOpen(false);
                    }}
                    className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100"
                  >
                    Messagerie
                  </button>
                  {user.roles.includes('admin') && (
                    <button
                      type="button"
                      onClick={() => {
                        navigate('/admin');
                        setMobileOpen(false);
                      }}
                      className="text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 col-span-2 text-orange-700"
                    >
                      Administration
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      void logout();
                    }}
                    className="text-left px-3 py-2.5 rounded-lg bg-red-50 text-red-700 col-span-2"
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/connexion');
                      setMobileOpen(false);
                    }}
                    className="text-center px-3 py-2.5 rounded-lg border border-slate-300"
                  >
                    Connexion
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/inscription');
                      setMobileOpen(false);
                    }}
                    className="text-center px-3 py-2.5 rounded-lg bg-orange-600 text-white"
                  >
                    Inscription
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-[#0B1528] text-slate-300 border-t border-[#1D345E] mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-orange-600 text-white font-display font-extrabold text-sm">
                  TSM
                </span>
                <span className="font-display font-bold text-white text-base">
                  TECH STYLE MARKET
                </span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                La marketplace multi-vendeurs conçue pour le Niger et l’expansion internationale.
                Achetez en ligne, commandez sur WhatsApp ou suivez les boutiques en direct.
              </p>
              <p className="text-xs text-slate-400 font-mono">
                Devise officielle : FCFA (XOF)
              </p>
            </div>

            <div>
              <h3 className="font-display font-semibold text-white text-sm mb-4">Marketplace</h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button type="button" onClick={() => navigate('/catalogue')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Explorer le catalogue
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/boutiques')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Toutes les boutiques
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/live')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Live Shopping en direct
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/creer-boutique')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Devenir vendeur
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold text-white text-sm mb-4">Informations légales</h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button type="button" onClick={() => navigate('/conditions-generales')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Conditions générales d’utilisation
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/politique-confidentialite')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Politique de confidentialité
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/contact')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Contact & Support
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/historique-commandes')} className="hover:text-orange-400 transition-colors cursor-pointer">
                    Suivre une commande
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold text-white text-sm mb-4">Contact officiel</h3>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li>Niamey, République du Niger</li>
                <li>
                  WhatsApp officiel :{' '}
                  <a
                    href={`https://wa.me/${OFFICIAL_WHATSAPP_RAW}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:underline font-mono"
                  >
                    {OFFICIAL_WHATSAPP_DISPLAY}
                  </a>
                </li>
                <li>Email : {OFFICIAL_EMAIL}</li>
                <li className="pt-2 flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-orange-500 shrink-0" />
                  <span>Paiement à la livraison vérifié</span>
                </li>
                <li className="flex items-center gap-2 text-xs text-slate-400">
                  <Store className="w-4 h-4 text-orange-500 shrink-0" />
                  <span>Boutiques certifiées au Niger</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-[#1D345E] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} TECH STYLE MARKET. Tous droits réservés.</p>
            <p>Niamey · Maradi · Zinder · Tahoua · Agadez · Dosso · Diffa · Tillabéri</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
