import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Terms & Conditions — Srivani Stores',
  description: 'Terms and Conditions for Srivani Stores online shopping.',
};

export default function TermsPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Terms & Conditions' }]} />
      <div className="page-head">
        <p className="eyebrow">The fine print</p>
        <h1>Terms &amp; Conditions</h1>
        <p className="sub">The terms that govern your use of this website and our online store.</p>
        <p className="updated">Last updated: May 2026</p>
      </div>
      <div className="prose">
        <h2>1. Acceptance</h2>
        <p>
          By using this website and placing an order, you agree to these Terms &amp; Conditions.
          If you do not agree, please do not use the site. These terms apply to Srivani Kirana
          &amp; General Stores, Sangareddy, Telangana (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;Srivani Stores&rdquo;).
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years of age, or use the site under the supervision of a
          parent or guardian, to place an order.
        </p>

        <h2>3. Products, pricing &amp; availability</h2>
        <p>
          We make every effort to display products, prices and availability accurately. Prices
          and availability may change without notice. In case of an obvious pricing error, we
          may cancel the affected order and refund any amount paid.
        </p>

        <h2>4. Orders</h2>
        <p>
          Your order is an offer to purchase. We confirm and accept orders subject to product
          availability and serviceability of your location. We may decline or cancel an order
          at our discretion, in which case any payment made will be refunded.
        </p>

        <h2>5. Payments</h2>
        <p>
          We accept payment by UPI, debit/credit card, and cash on delivery or pickup, as
          shown at checkout. Online payments are processed by third-party payment providers;
          we do not store your card or banking details.
        </p>

        <h2>6. Delivery &amp; pickup</h2>
        <p>
          Delivery and store pickup are governed by our{' '}
          <Link href="/shipping">Shipping &amp; Delivery Policy</Link>.
        </p>

        <h2>7. Cancellations &amp; refunds</h2>
        <p>
          Cancellations and refunds are governed by our{' '}
          <Link href="/refund">Refund &amp; Cancellation Policy</Link>.
        </p>

        <h2>8. Use of the site</h2>
        <p>
          You agree not to misuse the site, attempt unauthorised access, or use it for any
          unlawful purpose. All content, logos and trademarks on this site belong to Srivani
          Stores and may not be used without permission.
        </p>

        <h2>9. Limitation of liability</h2>
        <p>
          To the extent permitted by law, Srivani Stores is not liable for any indirect or
          consequential loss arising from the use of this site or our products, beyond the
          value of the order concerned.
        </p>

        <h2>10. Governing law</h2>
        <p>
          These terms are governed by the laws of India. Any disputes are subject to the
          exclusive jurisdiction of the courts at Sangareddy, Telangana.
        </p>

        <h2>11. Changes</h2>
        <p>
          We may update these terms from time to time. The latest version will always be
          available on this page.
        </p>

        <h2>Contact</h2>
        <p>
          For any questions about this policy, contact us at{' '}
          <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a> or{' '}
          <a href="tel:+919382828484">+91 93828 28484</a>.
        </p>
      </div>
    </div>
  );
}
