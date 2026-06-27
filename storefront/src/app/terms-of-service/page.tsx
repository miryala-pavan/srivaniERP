export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Terms of Service — Srivani Stores',
  description: 'Terms of Service governing your use of the Srivani Stores website and online shop.',
};

export default function TermsOfServicePage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Terms of Service' }]} />
      <div className="page-head">
        <p className="eyebrow">The fine print</p>
        <h1>Terms of Service</h1>
        <p className="sub">The terms that govern your use of this website and our online store.</p>
        <p className="updated">Last updated: June 2026</p>
      </div>
      <div className="prose">
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
          website <strong>shop.srivani.com</strong> and all related services (&ldquo;Services&rdquo;)
          operated by Srivani Kirana &amp; General Stores, Sangareddy, Telangana, India
          (&ldquo;Srivani Stores&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).
          By accessing or using our Services you agree to be bound by these Terms.
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By using this website, creating an account, or placing an order, you confirm that you
          have read, understood, and agree to these Terms and our{' '}
          <Link href="/privacy-policy">Privacy Policy</Link>. If you do not agree, please do not
          use the Services.
        </p>

        <h2>2. Eligibility</h2>
        <p>
          You must be at least 18 years of age to place an order. Minors may use the Services
          only under the supervision of a parent or legal guardian who agrees to these Terms.
        </p>

        <h2>3. Products, pricing &amp; availability</h2>
        <p>
          We make every effort to display products, prices and stock availability accurately.
          Prices are in Indian Rupees (INR) and include applicable taxes unless stated otherwise.
          Prices and availability may change without prior notice. In the event of an obvious
          pricing error, we reserve the right to cancel the affected order and refund any payment
          made in full.
        </p>

        <h2>4. Orders</h2>
        <p>
          Placing an order constitutes an offer to purchase subject to these Terms. We reserve
          the right to accept or decline any order at our discretion — for example, due to stock
          unavailability or inability to deliver to your location. Where an order is declined
          after payment, we will issue a full refund within 5–7 business days.
        </p>

        <h2>5. Payments</h2>
        <p>
          We accept UPI, debit/credit card, net banking, and cash on delivery or store pickup
          where available, as displayed at checkout. Online payments are processed by Razorpay
          (a PCI-DSS-compliant payment gateway). We do not store your card or bank account
          details. By completing payment you authorise us to charge the total order amount
          including delivery charges and taxes.
        </p>

        <h2>6. Delivery &amp; pickup</h2>
        <p>
          Delivery timelines, charges, and store pickup options are described in our{' '}
          <Link href="/shipping">Shipping &amp; Delivery Policy</Link>. We are not responsible
          for delays caused by circumstances beyond our control (force majeure, courier delays,
          natural events, etc.).
        </p>

        <h2>7. Cancellations &amp; refunds</h2>
        <p>
          Cancellation and refund terms are described in our{' '}
          <Link href="/refund">Refund &amp; Cancellation Policy</Link>. For perishable or
          fast-moving grocery items, cancellations must be requested before the order is
          dispatched.
        </p>

        <h2>8. WhatsApp ordering</h2>
        <p>
          We may offer order placement and customer support via WhatsApp. By initiating contact
          on WhatsApp you agree that messages are processed via the WhatsApp Business Platform
          (Meta Platforms, Inc.) and are subject to Meta&rsquo;s Terms of Service. You also
          acknowledge our <Link href="/privacy-policy">Privacy Policy</Link>, which covers how
          we handle WhatsApp data.
        </p>

        <h2>9. User accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials
          and for all activity under your account. Notify us immediately at{' '}
          <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a> if you
          suspect unauthorised access. We reserve the right to suspend or terminate accounts
          that violate these Terms.
        </p>

        <h2>10. Acceptable use</h2>
        <p>
          You agree not to: misuse or attempt to disrupt our Services; scrape or harvest data
          without permission; submit false orders or fraudulent payment information; impersonate
          any person or entity; or use the Services for any unlawful purpose. Violation may
          result in immediate termination of your account and referral to law enforcement.
        </p>

        <h2>11. Intellectual property</h2>
        <p>
          All content on this website — including text, images, logos, and software — is owned
          by or licensed to Srivani Stores. You may not reproduce, distribute, or create
          derivative works without our prior written permission.
        </p>

        <h2>12. Limitation of liability</h2>
        <p>
          To the maximum extent permitted by applicable law, Srivani Stores shall not be liable
          for any indirect, incidental, or consequential loss arising from your use of the
          Services. Our total liability for any claim arising out of these Terms shall not exceed
          the value of the specific order to which the claim relates.
        </p>

        <h2>13. Governing law &amp; disputes</h2>
        <p>
          These Terms are governed by the laws of India. Any dispute arising from these Terms
          shall first be attempted to be resolved through mutual negotiation. If unresolved,
          disputes shall be subject to the exclusive jurisdiction of the courts at Sangareddy,
          Telangana.
        </p>

        <h2>14. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. The current version will always be
          available at <strong>shop.srivani.com/terms-of-service</strong>. Continued use of the
          Services after changes are posted constitutes your acceptance of the revised Terms.
        </p>

        <h2>Contact us</h2>
        <p>
          For questions about these Terms, contact us at:
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
