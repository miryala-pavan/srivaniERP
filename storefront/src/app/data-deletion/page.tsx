export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Data Deletion Request — Srivani Stores',
  description: 'Request deletion of your personal data held by Srivani Stores.',
};

export default function DataDeletionPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Data Deletion' }]} />
      <div className="page-head">
        <p className="eyebrow">Your rights</p>
        <h1>Data Deletion Request</h1>
        <p className="sub">
          You can request that we delete all personal data we hold about you.
        </p>
        <p className="updated">Last updated: June 2026</p>
      </div>
      <div className="prose">
        <p>
          Srivani Kirana &amp; General Stores (&ldquo;Srivani Stores&rdquo;) respects your right
          to data deletion under the Digital Personal Data Protection Act, 2023 (India) and
          applicable Meta / WhatsApp platform policies.
        </p>

        <h2>What data we hold</h2>
        <p>Depending on how you have interacted with us, we may hold:</p>
        <ul>
          <li>Account information — name, phone number, email address</li>
          <li>Order history — items ordered, delivery address, payment references</li>
          <li>WhatsApp messages — messages sent to our WhatsApp Business number</li>
          <li>Login data — Google Sign-In profile (name, email, photo) if you used Google login</li>
          <li>Device &amp; usage data — browser type, pages visited</li>
        </ul>

        <h2>How to request deletion</h2>
        <p>Send a deletion request using any of the methods below. Include your registered
        phone number or email address so we can locate your account.</p>

        <h3>Option 1 — Email</h3>
        <p>
          Email us at{' '}
          <a href="mailto:srivanistore.srd@gmail.com?subject=Data%20Deletion%20Request&body=Please%20delete%20all%20personal%20data%20associated%20with%20my%20account.%0A%0AName%3A%0APhone%3A%0AEmail%3A">
            srivanistore.srd@gmail.com
          </a>{' '}
          with the subject line <strong>&ldquo;Data Deletion Request&rdquo;</strong> and include
          your name, registered phone number, and/or email address.
        </p>

        <h3>Option 2 — WhatsApp</h3>
        <p>
          Send a WhatsApp message to{' '}
          <a href="https://wa.me/919382828484?text=Data%20Deletion%20Request%3A%20Please%20delete%20all%20personal%20data%20associated%20with%20my%20account.">
            +91 93828 28484
          </a>{' '}
          with the message <strong>&ldquo;Data Deletion Request&rdquo;</strong> and your
          registered phone number or email.
        </p>

        <h3>Option 3 — Phone</h3>
        <p>
          Call us at <a href="tel:+919382828484">+91 93828 28484</a> during business hours
          (Mon–Sat, 9 AM – 7 PM IST) and request account and data deletion.
        </p>

        <h2>What happens after your request</h2>
        <ul>
          <li>We will verify your identity using the contact details you provide.</li>
          <li>
            We will delete or anonymise your personal data within <strong>30 days</strong> of
            receiving your verified request.
          </li>
          <li>
            We will send you a confirmation by email or WhatsApp once deletion is complete.
          </li>
        </ul>

        <h2>Exceptions</h2>
        <p>
          Certain data may be retained beyond your deletion request where required by Indian law —
          for example, transaction records and invoices are retained for 7 years for GST and
          accounting compliance. In such cases, the data is used only for legal compliance and
          is not used for any other purpose.
        </p>

        <h2>WhatsApp / Meta data</h2>
        <p>
          If you contacted us via WhatsApp, your messages were processed through the{' '}
          <strong>WhatsApp Business Platform</strong> (operated by Meta Platforms, Inc.). Deleting
          your data with us removes our copy of those interactions. To also delete your data
          from Meta&rsquo;s systems, please refer to Meta&rsquo;s own{' '}
          <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>{' '}
          and use the data controls in your WhatsApp or Facebook account settings.
        </p>

        <h2>Contact</h2>
        <p>
          For any questions about this process, contact us at:
        </p>
        <ul>
          <li>Email: <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a></li>
          <li>Phone: <a href="tel:+919382828484">+91 93828 28484</a></li>
          <li>Address: Srivani Kirana &amp; General Stores, Sangareddy, Telangana, India</li>
        </ul>
      </div>
    </div>
  );
}
