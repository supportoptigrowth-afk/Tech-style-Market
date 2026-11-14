/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppProvider, useApp } from './context/AppContext';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages';
import { CartPage, CheckoutPage } from './pages/CartAndCheckoutPages';
import { CatalogPage } from './pages/CatalogPage';
import { ClientDashboardPage } from './pages/ClientDashboardPage';
import { HomePage } from './pages/HomePage';
import { ContactPage, PrivacyPage, TermsPage } from './pages/LegalAndContactPages';
import { LiveDirectoryPage, LiveRoomPage } from './pages/LiveShoppingPage';
import { MessagingPage, NotificationsPage } from './pages/MessagingAndNotificationsPages';
import { OrderDetailPage, OrdersHistoryPage } from './pages/OrdersPages';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ShopPublicPage, ShopsDirectoryPage } from './pages/ShopPublicPage';
import { CreateShopPage, VendorDashboardPage } from './pages/VendorPages';

function RouterView() {
  const { path } = useApp();
  const pathname = path.split('?')[0] || '/';

  if (pathname === '/') return <HomePage />;
  if (pathname === '/catalogue') return <CatalogPage />;
  if (pathname.startsWith('/produit/')) {
    const id = decodeURIComponent(pathname.replace('/produit/', ''));
    return <ProductDetailPage productId={id} />;
  }
  if (pathname === '/boutiques') return <ShopsDirectoryPage />;
  if (pathname.startsWith('/boutique/')) {
    const slug = decodeURIComponent(pathname.replace('/boutique/', ''));
    return <ShopPublicPage slug={slug} />;
  }
  if (pathname === '/connexion') return <LoginPage />;
  if (pathname === '/inscription') return <RegisterPage />;
  if (pathname === '/mot-de-passe-oublie') return <ForgotPasswordPage />;
  if (pathname === '/espace-client') return <ClientDashboardPage initialTab="apercu" />;
  if (pathname === '/profil') return <ClientDashboardPage initialTab="profil" />;
  if (pathname === '/espace-vendeur') return <VendorDashboardPage defaultTab="apercu" />;
  if (pathname === '/gestion-produits') return <VendorDashboardPage defaultTab="produits" />;
  if (pathname === '/creer-boutique') return <CreateShopPage />;
  if (pathname === '/panier') return <CartPage />;
  if (pathname === '/commande') return <CheckoutPage />;
  if (pathname === '/historique-commandes') return <OrdersHistoryPage />;
  if (pathname.startsWith('/commande/')) {
    const id = decodeURIComponent(pathname.replace('/commande/', ''));
    return <OrderDetailPage orderId={id} />;
  }
  if (pathname === '/live') return <LiveDirectoryPage />;
  if (pathname.startsWith('/live/')) {
    const slug = decodeURIComponent(pathname.replace('/live/', ''));
    return <LiveRoomPage slug={slug} />;
  }
  if (pathname === '/messagerie') return <MessagingPage />;
  if (pathname === '/notifications') return <NotificationsPage />;
  if (pathname === '/admin') return <AdminPage />;
  if (pathname === '/conditions-generales') return <TermsPage />;
  if (pathname === '/politique-confidentialite') return <PrivacyPage />;
  if (pathname === '/contact') return <ContactPage />;

  return <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <Layout>
          <RouterView />
        </Layout>
      </AppProvider>
    </AuthProvider>
  );
}
