import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk } from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import BottomNav from '@/components/BottomNav';
import ScrollWatcher from '@/components/ScrollWatcher';
import { CartProvider } from '@/context/CartContext';
import { AuthProvider } from '@/context/AuthContext';
import { WishlistProvider } from '@/context/WishlistContext';
import CartPanel from '@/components/CartPanel';
import SentryInit from '@/components/SentryInit';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Srivani Stores — Shop Online',
  description: 'Fresh groceries from Srivani Stores, Sangareddy. Pure, Trust & Quality since 1983.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4002'),
  openGraph: {
    siteName: 'Srivani Stores',
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Srivani Stores — Pure, Trust & Quality since 1983' }],
  },
  other: { 'theme-color': '#D98324' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <head>
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')`,
            }}
          />
        )}
      </head>
      <body>
        <div className="grain" aria-hidden="true" />
        <SentryInit />
        <WishlistProvider>
        <AuthProvider>
          <CartProvider>
            <ScrollWatcher />
            <SiteHeader />
            <main>{children}</main>
            <SiteFooter />
            <BottomNav />
            <CartPanel />
          </CartProvider>
        </AuthProvider>
        </WishlistProvider>
      </body>
    </html>
  );
}
