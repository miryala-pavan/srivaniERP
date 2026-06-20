import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Contact Us — Srivani Stores',
  description: 'Contact Srivani Stores, Sangareddy — phone, WhatsApp, email and address.',
};

export default function ContactPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Contact' }]} />
      <div className="page-head">
        <p className="eyebrow">Get in touch</p>
        <h1>Contact Us</h1>
        <p className="sub">
          We&apos;d love to help. Call, WhatsApp or email &mdash; and you can order from us today.
        </p>
      </div>

      <div className="prose">
        <div className="cbox-grid">
          <div className="cbox">
            <p>
              <b>Call or WhatsApp</b>
              <a href="tel:+919382828484">+91 93828 28484</a>
              <br />
              <a
                href="https://wa.me/919382828484?text=Hello%20Srivani%20Stores%2C%20I%27d%20like%20to%20place%20an%20order."
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: '6px', display: 'inline-block' }}
              >
                Message on WhatsApp
              </a>
            </p>
          </div>

          <div className="cbox">
            <p>
              <b>Email</b>
              <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a>
            </p>
          </div>

          <div className="cbox">
            <p>
              <b>Visit us</b>
              Srivani Kirana &amp; General Stores,
              <br />
              New Bus Stand Area, Sangareddy, Telangana
              <br />
              <a
                href="https://www.google.com/maps/search/Srivani+Stores+Sangareddy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: '6px', display: 'inline-block' }}
              >
                Find us on the map
              </a>
            </p>
          </div>

          <div className="cbox">
            <p>
              <b>Store hours</b>
              Monday &ndash; Sunday
              <br />
              8:00 AM &ndash; 9:30 PM
            </p>
          </div>
        </div>

        <h2>Order on WhatsApp</h2>
        <p>
          The easiest way to order is to WhatsApp us at{' '}
          <a
            href="https://wa.me/919382828484?text=Hello%20Srivani%20Stores%2C%20I%27d%20like%20to%20place%20an%20order."
            target="_blank"
            rel="noopener noreferrer"
          >
            +91 93828 28484
          </a>
          . We&apos;ll confirm your order, delivery slot, and payment &mdash; all on chat.
        </p>

        <h2>Legal &amp; Privacy</h2>
        <p>
          <Link href="/privacy-policy">Privacy Policy</Link> &nbsp;&middot;&nbsp;
          <Link href="/terms-of-service">Terms of Service</Link> &nbsp;&middot;&nbsp;
          <Link href="/data-deletion">Data Deletion Request</Link>
        </p>
      </div>
    </div>
  );
}
