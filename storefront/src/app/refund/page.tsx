export const dynamic = 'force-dynamic';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Refund & Cancellation Policy — Srivani Stores',
  description: 'Srivani Stores refund and cancellation policy.',
};

export default function RefundPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Refund & Cancellation Policy' }]} />
      <div className="page-head">
        <p className="eyebrow">Refunds &amp; cancellations</p>
        <h1>Refund &amp; Cancellation Policy</h1>
        <p className="sub">How cancellations, returns and refunds work.</p>
        <p className="updated">Last updated: May 2026</p>
      </div>
      <div className="prose">
        <h2>1. Order cancellation</h2>
        <p>
          You may cancel an order free of charge any time before it is packed or dispatched
          / marked ready for pickup. Once an order is on its way or ready for collection,
          it may not be cancellable.
        </p>

        <h2>2. Damaged, wrong or missing items</h2>
        <p>
          If you receive a damaged, incorrect or missing item, please contact us within
          24 hours of delivery or pickup, with a photo where possible. We will arrange a
          replacement or refund for the affected items.
        </p>

        <h2>3. Perishable &amp; fresh items</h2>
        <p>
          For reasons of hygiene and safety, fresh and perishable goods cannot be returned
          once accepted, except where they are damaged or not as described.
        </p>

        <h2>4. Refund method &amp; timeline</h2>
        <p>
          Approved refunds are issued to your original payment method, or as store credit
          where you prefer. Online refunds are typically processed within 5&ndash;7 business
          days, depending on your bank or provider.
        </p>

        <h2>5. How to request</h2>
        <p>
          To request a cancellation or refund, contact us at{' '}
          <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a> or{' '}
          <a href="tel:+919382828484">+91 93828 28484</a> with your order details.
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
