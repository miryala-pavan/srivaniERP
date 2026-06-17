'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';

const HomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);
const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const CartIconSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>
);
const AccountIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

export default function BottomNav() {
  const path = usePathname();
  const { totalItems } = useCart();
  const { isLoggedIn, user } = useAuth();

  const openCategories = () => {
    document.dispatchEvent(new CustomEvent('openMobileNav'));
  };

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      <div className="bottom-nav-inner">

        <Link href="/" title="Go to homepage"
          className={`bottom-tab${path === '/' ? ' active' : ''}`}>
          <HomeIcon />
          Home
        </Link>

        <button className="bottom-tab" title="Browse all product categories"
          onClick={openCategories} aria-label="Browse categories">
          <GridIcon />
          Categories
        </button>

        <Link href="/search" title="Search for products"
          className={`bottom-tab${path === '/search' ? ' active' : ''}`}>
          <SearchIcon />
          Search
        </Link>

        <Link
          href="/cart"
          title={totalItems > 0 ? `Your cart — ${totalItems} item${totalItems !== 1 ? 's' : ''}` : 'Your cart is empty'}
          className={`bottom-tab${path === '/cart' ? ' active' : ''}`}
          style={{ position: 'relative', color: totalItems > 0 ? 'var(--saffron)' : undefined }}
        >
          <CartIconSvg />
          Cart
          {totalItems > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: '12px',
              background: 'var(--saffron)', color: '#fff',
              fontSize: '9px', fontWeight: 800, borderRadius: '999px',
              minWidth: '16px', height: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 3px', lineHeight: 1,
            }}>
              {totalItems > 99 ? '99+' : totalItems}
            </span>
          )}
        </Link>

        <Link
          href={isLoggedIn ? '/login' : `/login?redirect=${encodeURIComponent(path)}`}
          title={isLoggedIn ? `Account: ${user?.name}` : 'Sign in or create an account'}
          className={`bottom-tab${path === '/login' ? ' active' : ''}`}
          style={{ color: isLoggedIn ? 'var(--saffron)' : undefined }}
        >
          {isLoggedIn && user ? (
            <span style={{
              width: '22px', height: '22px', borderRadius: '50%',
              background: 'var(--saffron)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 900,
            }}>
              {user.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <AccountIcon />
          )}
          {isLoggedIn ? 'Account' : 'Sign In'}
        </Link>

      </div>
    </nav>
  );
}
