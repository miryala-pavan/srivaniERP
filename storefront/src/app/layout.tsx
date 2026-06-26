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

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4002').replace(/\/$/, '');

const LOCAL_BUSINESS_LD = {
  '@context': 'https://schema.org',
  '@type': ['GroceryStore', 'LocalBusiness'],
  name: 'Srivani Stores',
  alternateName: 'Sri Vani Kirana & General Stores',
  description: 'Fresh groceries, staples, oils, dals, masalas, dairy and household essentials. Serving Sangareddy, Telangana since 1983.',
  url: SITE_URL,
  telephone: '+919382828484',
  email: 'srivanistore.srd@gmail.com',
  logo: `${SITE_URL}/logo.png`,
  image: `${SITE_URL}/logo.png`,
  foundingDate: '1983',
  priceRange: '₹-₹₹',
  paymentAccepted: 'Cash, UPI, Debit Card, Credit Card',
  currenciesAccepted: 'INR',
  address: {
    '@type': 'PostalAddress',
    streetAddress: '3-5-14 Main Road, Opp New Bus Stand',
    addressLocality: 'Sangareddy',
    addressRegion: 'Telangana',
    postalCode: '502001',
    addressCountry: 'IN',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 17.4148,
    longitude: 78.0877,
  },
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: '08:00',
      closes: '21:30',
    },
  ],
  hasMap: 'https://www.google.com/maps/search/Srivani+Stores+Sangareddy',
  sameAs: ['https://wa.me/919382828484'],
};

const WEBSITE_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Srivani Stores',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Srivani Stores — Online Grocery, Sangareddy, Telangana',
    template: '%s | Srivani Stores, Sangareddy',
  },
  description:
    'Shop fresh groceries, staples, oils, dals, masalas and household essentials online. Free home delivery in Sangareddy, Telangana. Trusted since 1983.',
  keywords: [
    'grocery store Sangareddy', 'kirana store Sangareddy', 'online grocery Sangareddy',
    'home delivery grocery Sangareddy', 'grocery Telangana', 'Srivani Stores',
    'Sri Vani Kirana', 'online grocery Telangana', 'buy groceries online Sangareddy',
  ],
  authors: [{ name: 'Srivani Stores' }],
  openGraph: {
    type: 'website',
    siteName: 'Srivani Stores',
    title: 'Srivani Stores — Online Grocery, Sangareddy, Telangana',
    description:
      'Shop fresh groceries, staples, oils, dals, masalas and household essentials online. Free home delivery in Sangareddy, Telangana. Trusted since 1983.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Srivani Stores — Pure, Trust & Quality since 1983' }],
  },
  twitter: {
    card: 'summary',
    title: 'Srivani Stores — Online Grocery, Sangareddy',
    description: 'Fresh groceries delivered home in Sangareddy, Telangana. Pure, Trust & Quality since 1983.',
    images: ['/logo.png'],
  },
  robots: { index: true, follow: true },
  verification: { google: 'sWmIokErR7KC55s3RJ0fw1STUB5ihhBgCELL1XEqAoE' },
  other: { 'theme-color': '#D98324' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${hanken.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_LD) }}
        />
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
