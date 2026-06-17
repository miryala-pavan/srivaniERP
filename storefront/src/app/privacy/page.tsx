import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Privacy Policy — Srivani Stores',
  description: 'How Srivani Stores collects, uses and protects your information.',
};

export default function PrivacyPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Privacy Policy' }]} />
      <div className="page-head">
        <p className="eyebrow">Your privacy</p>
        <h1>Privacy Policy</h1>
        <p className="sub">How we collect, use and protect your personal information.</p>
        <p className="updated">Last updated: May 2026</p>
      </div>
      <div className="prose">
        <h2>1. Information we collect</h2>
        <p>
          When you register or place an order, we may collect your name, phone number, email
          address, delivery address, and order history. Payment is handled by our payment
          provider &mdash; we do not store your card or bank details.
        </p>

        <h2>2. How we use your information</h2>
        <p>
          We use your information to process and deliver your orders, communicate order
          updates, provide support, and improve our service. We may send you order-related
          messages by SMS, WhatsApp or email.
        </p>

        <h2>3. Cookies</h2>
        <p>
          Our site may use cookies and similar technologies to keep you signed in and improve
          your experience. You can control cookies through your browser settings.
        </p>

        <h2>4. Sharing your information</h2>
        <p>
          We share information only as needed to fulfil your order &mdash; for example with
          our delivery staff, payment provider, and SMS/WhatsApp provider. We do not sell
          your personal information to anyone.
        </p>

        <h2>5. Data security</h2>
        <p>
          We take reasonable measures to protect your information. However, no method of
          transmission over the internet is completely secure, and we cannot guarantee
          absolute security.
        </p>

        <h2>6. Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data by
          contacting us. We handle personal data in line with applicable Indian law,
          including the Digital Personal Data Protection Act, 2023.
        </p>

        <h2>7. Children</h2>
        <p>
          Our online store is intended for adults. We do not knowingly collect personal
          information from children.
        </p>

        <h2>8. Changes</h2>
        <p>
          We may update this policy from time to time. The latest version will always be
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
