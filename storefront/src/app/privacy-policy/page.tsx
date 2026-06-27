export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Privacy Policy — Srivani Stores',
  description: 'How Srivani Stores collects, uses and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Privacy Policy' }]} />
      <div className="page-head">
        <p className="eyebrow">Your privacy</p>
        <h1>Privacy Policy</h1>
        <p className="sub">How we collect, use and protect your personal information.</p>
        <p className="updated">Last updated: June 2026</p>
      </div>
      <div className="prose">
        <p>
          This Privacy Policy applies to Srivani Kirana &amp; General Stores, Sangareddy,
          Telangana, India (&ldquo;Srivani Stores&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;our&rdquo;). It explains how we collect, use, share and protect your personal
          information when you use our website (<strong>shop.srivani.com</strong>), mobile-optimised
          storefront, WhatsApp Business channel, or any related service (collectively,
          the &ldquo;Services&rdquo;).
        </p>

        <h2>1. Information we collect</h2>
        <h3>1a. Information you provide directly</h3>
        <ul>
          <li><strong>Account details</strong> — name, phone number, email address, and password (hashed) when you register.</li>
          <li><strong>Order information</strong> — delivery address, cart contents, and any notes you add at checkout.</li>
          <li><strong>Payment details</strong> — payment method and transaction reference. Card or bank details are handled entirely by our payment provider (Razorpay) and are never stored on our servers.</li>
          <li><strong>Communications</strong> — messages you send us via WhatsApp, email, or our contact form.</li>
        </ul>

        <h3>1b. Information collected automatically</h3>
        <ul>
          <li><strong>Device &amp; usage data</strong> — browser type, operating system, pages visited, time spent, referring URL.</li>
          <li><strong>Cookies &amp; local storage</strong> — session tokens, cart state, and preference settings. See Section 5.</li>
          <li><strong>Location (approximate)</strong> — city/region derived from your IP address, used only for service availability checks. We do not collect GPS location.</li>
        </ul>

        <h3>1c. Information from third parties</h3>
        <ul>
          <li><strong>Google Sign-In</strong> — if you log in with Google, we receive your name, email address and profile picture from Google. We do not receive your Google password.</li>
          <li><strong>WhatsApp Business</strong> — if you contact us via WhatsApp, Meta (WhatsApp&rsquo;s parent company) may share your WhatsApp phone number and message content with us through the WhatsApp Business Platform. This data is subject to Meta&rsquo;s Privacy Policy as well as ours.</li>
          <li><strong>Payment providers</strong> — Razorpay may share transaction status and masked payment details to confirm your order.</li>
        </ul>

        <h2>2. How we use your information</h2>
        <ul>
          <li>Process and fulfil your orders, and send order confirmations and delivery updates.</li>
          <li>Authenticate your account and keep it secure.</li>
          <li>Respond to your questions and support requests.</li>
          <li>Send you transactional messages via SMS, WhatsApp, or email (e.g. order status, delivery alerts).</li>
          <li>Improve our website, product catalogue, and services.</li>
          <li>Comply with legal obligations under Indian law.</li>
        </ul>
        <p>
          We do <strong>not</strong> use your data for automated profiling, targeted advertising on
          third-party platforms, or any purpose incompatible with the above.
        </p>

        <h2>3. WhatsApp Business data</h2>
        <p>
          When you message us on WhatsApp, we use the WhatsApp Business Platform (provided by Meta
          Platforms, Inc.) to receive and respond to your messages. By messaging us on WhatsApp you
          acknowledge that:
        </p>
        <ul>
          <li>Your messages are processed via Meta&rsquo;s infrastructure and are subject to Meta&rsquo;s own Terms of Service and Privacy Policy.</li>
          <li>We store message content only as long as necessary to serve your request or as required by law.</li>
          <li>We do not share WhatsApp message content with any third party other than what is strictly required to fulfil your order.</li>
          <li>You may request deletion of your WhatsApp interaction data — see Section 9.</li>
        </ul>

        <h2>4. Sharing your information</h2>
        <p>We share your information only in the following circumstances:</p>
        <ul>
          <li><strong>Order fulfilment</strong> — with our delivery staff or third-party couriers to complete your delivery.</li>
          <li><strong>Payment processing</strong> — with Razorpay to process payments securely.</li>
          <li><strong>Messaging services</strong> — with SMS, WhatsApp, or email providers to send you order updates.</li>
          <li><strong>Google</strong> — if you use Google Sign-In, authentication is handled by Google in accordance with their Privacy Policy.</li>
          <li><strong>Legal requirements</strong> — if required by law, court order, or to protect the rights and safety of our customers or staff.</li>
        </ul>
        <p>We do <strong>not</strong> sell, rent, or trade your personal information to any third party.</p>

        <h2>5. Cookies</h2>
        <p>
          We use essential cookies for authentication (keeping you logged in) and cart state. We
          use analytical cookies to understand how visitors use our site. You can disable cookies
          via your browser settings, though this may affect the functionality of the site.
        </p>

        <h2>6. Data retention</h2>
        <p>
          We retain your personal data for as long as your account is active or as needed to
          provide services. Order records are retained for seven years as required by Indian
          accounting and tax laws. If you request account deletion, we will delete your personal
          data within 30 days, except where retention is required by law.
        </p>

        <h2>7. Data security</h2>
        <p>
          We use industry-standard security measures including encrypted connections (HTTPS),
          hashed passwords, and access controls. However, no method of internet transmission is
          completely secure, and we cannot guarantee absolute security.
        </p>

        <h2>8. Children</h2>
        <p>
          Our services are intended for individuals aged 18 and above. We do not knowingly collect
          personal information from children. If you believe a child has provided us with personal
          information, please contact us and we will delete it.
        </p>

        <h2>9. Your rights &amp; data deletion</h2>
        <p>
          Under the Digital Personal Data Protection Act, 2023 (India) and other applicable laws,
          you have the right to:
        </p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Request deletion of your personal data.</li>
          <li>Withdraw consent for data processing (where consent is the legal basis).</li>
        </ul>
        <p>
          To exercise any of these rights, please visit our{' '}
          <a href="/data-deletion">Data Deletion page</a> or contact us directly. We will
          respond within 30 days.
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. The latest version will always be available
          at <strong>shop.srivani.com/privacy-policy</strong>. We will notify you of significant
          changes via email or a prominent notice on our website.
        </p>

        <h2>Contact us</h2>
        <p>
          For privacy-related questions or to exercise your rights, contact us at:
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
