import Image from 'next/image';
import Link from 'next/link';
import SearchBar from './SearchBar';
import MegaMenu from './MegaMenu';
import CartIcon from './CartIcon';
import LoginButton from './LoginButton';
import { getNavTree } from '@/lib/shop';
import type { NavDepartment } from '@/lib/shop';

export default async function SiteHeader() {
  let navTree: NavDepartment[] = [];
  try { navTree = await getNavTree(); } catch {}

  return (
    <header className="site-header">
      <div className="wrap">
        <div className="bar">
          <Link href="/" className="brand" title="Srivani Stores — Home">
            <Image
              src="/logo.png"
              alt="Srivani Stores logo"
              width={34}
              height={34}
              style={{ objectFit: 'contain' }}
            />
            <span className="mark">SRIVANI <b>STORES</b></span>
            <span className="est">Est. 1983 · Sangareddy</span>
          </Link>
          <SearchBar />
          <nav className="bar-nav">
            <Link href="/" title="Go to homepage">Home</Link>
            <MegaMenu navTree={navTree} />
            <Link href="/products" title="Browse all products">Browse</Link>
            <Link href="/deals" title="View today's deals and offers" style={{ color: 'var(--saffron)', fontWeight: 700 }}>🏷️ Deals</Link>
            <Link href="/about" title="About Srivani Stores">About</Link>
            <LoginButton />
            <CartIcon />
          </nav>
        </div>
      </div>
    </header>
  );
}
