import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Shipping & Delivery Policy — Srivani Stores',
  description: 'Srivani Stores delivery and pickup policy.',
};

export default function ShippingPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'Shipping & Delivery Policy' }]} />
      <div className="page-head">
        <p className="eyebrow">Delivery &amp; pickup</p>
        <h1>Shipping &amp; Delivery Policy</h1>
        <p className="sub">How we deliver your order, and how store pickup works.</p>
        <p className="updated">Last updated: May 2026</p>
      </div>
      <div className="prose">
        <h2>1. Delivery area</h2>
        <p>
          We deliver within Sangareddy and surrounding serviceable areas. Serviceability
          for your address is confirmed at checkout based on your location.
        </p>

        <h2>2. Delivery charges &amp; minimum order</h2>
        <p>
          Any delivery charge and minimum order value will be shown clearly at checkout
          before you pay. Orders above the minimum value may qualify for free delivery.
        </p>

        <h2>3. Delivery time</h2>
        <p>
          We aim to deliver your order on the same or next day, within the delivery window
          shown at checkout. Times may vary during peak periods, festivals or due to weather.
        </p>

        <h2>4. Store pickup</h2>
        <p>
          You may choose to collect your order from our store. We will notify you when it
          is packed and ready at the counter.
        </p>

        <h2>5. Unsuccessful delivery</h2>
        <p>
          If we are unable to deliver because no one is available or the address is
          incorrect, we will contact you to reschedule. Repeated failed attempts may result
          in cancellation.
        </p>

        <h2>Contact</h2>
        <p>
          For any questions about this policy, contact us at{' '}
          <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a> or{' '}
          <a href="tel:+919382828484">+91 93828 28484</a>.
          Also see our <Link href="/refund">Refund &amp; Cancellation Policy</Link>.
        </p>
      </div>
    </div>
  );
}
