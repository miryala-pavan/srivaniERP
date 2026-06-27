'use client';
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="legal">
          <b>Sri Vani Kirana &amp; General Stores</b> · Sangareddy, Telangana · GSTIN 36AESPM7617R1ZE
        </div>
        <span className="fssai">FSSAI Licensed</span>

        {/* Social links */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', margin: '14px 0 4px' }}>
          <a
            href="https://wa.me/919382828484"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            title="Order on WhatsApp"
            style={{ color: '#25D366', opacity: 0.85, transition: 'opacity .2s' }}
            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
            onMouseOut={e => (e.currentTarget.style.opacity = '0.85')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z"/>
            </svg>
          </a>

          <a
            href="https://www.facebook.com/srivanistore/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            title="Follow us on Facebook"
            style={{ color: '#1877F2', opacity: 0.85, transition: 'opacity .2s' }}
            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
            onMouseOut={e => (e.currentTarget.style.opacity = '0.85')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </a>

          <a
            href="https://www.instagram.com/srivanigroup/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            title="Follow us on Instagram"
            style={{ color: '#E1306C', opacity: 0.85, transition: 'opacity .2s' }}
            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
            onMouseOut={e => (e.currentTarget.style.opacity = '0.85')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </a>

          <a
            href="https://www.google.com/maps/search/Srivani+Stores+Sangareddy"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Google Maps"
            title="Find us on Google Maps"
            style={{ color: '#EA4335', opacity: 0.85, transition: 'opacity .2s' }}
            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
            onMouseOut={e => (e.currentTarget.style.opacity = '0.85')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </a>
        </div>

        <div className="footer-links">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/shipping">Shipping Policy</Link>
          <Link href="/refund">Refund Policy</Link>
          <Link href="/terms-of-service">Terms of Service</Link>
          <Link href="/data-deletion">Data Deletion</Link>
        </div>
        <div className="legal">&copy; 2026 Sri Vani Stores</div>
      </div>
    </footer>
  );
}
