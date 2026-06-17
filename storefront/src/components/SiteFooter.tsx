import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="legal">
          <b>Sri Vani Kirana &amp; General Stores</b> · Sangareddy, Telangana · GSTIN 36AESPM7617R1ZE
        </div>
        <span className="fssai">FSSAI Licensed</span>
        <div className="footer-links">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/shipping">Shipping Policy</Link>
          <Link href="/refund">Refund Policy</Link>
          <Link href="/terms">Terms &amp; Conditions</Link>
        </div>
        <div className="legal">&copy; 2026 Sri Vani Stores</div>
      </div>
    </footer>
  );
}
