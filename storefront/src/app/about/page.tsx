import type { Metadata } from 'next';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';

export const metadata: Metadata = {
  title: 'About Us — Srivani Stores',
  description: 'Srivani Stores, Sangareddy — Pure, Trust & Quality since 1983.',
};

export default function AboutPage() {
  return (
    <div className="wrap">
      <Breadcrumbs crumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]} />
      <div className="page-head">
        <p className="eyebrow">Our story</p>
        <h1>About Srivani Stores</h1>
        <p className="sub">Pure, Trust &amp; Quality &mdash; serving Sangareddy since 1983.</p>
      </div>
      <div className="prose">
        <p>
          Srivani Kirana &amp; General Stores was founded in 1983 by Mr. M. Pandurangam in the
          heart of the New Bus Stand area of Sangareddy &mdash; the first retail store of its kind
          in town. What began with a small investment and a simple promise grew, over four decades,
          into a name local families trust for their everyday needs.
        </p>

        <h2>Four decades of service</h2>
        <p>
          Our promise has stayed the same from the very first day: give every family a complete
          range of general and kirana goods at near-wholesale prices, packed fresh and delivered
          home. That commitment to purity, trust and quality is what keeps generations of
          Sangareddy households coming back.
        </p>

        <h2>What we offer</h2>
        <ul>
          <li>Everyday groceries, oils &amp; ghee, dals &amp; pulses, and masalas</li>
          <li>Dairy, beverages, snacks and packaged foods</li>
          <li>Cleaning supplies, personal care and household essentials</li>
          <li>Fresh items and our own Srivani-brand freshly repacked grains, dals, dry fruits &amp; masala</li>
        </ul>

        <h2>Now online</h2>
        <p>
          We&apos;ve brought the store to your phone. Browse our full range, order in a few taps,
          and choose home delivery or store pickup &mdash; paying online or by cash. The same store
          you trust, now a tap away.
        </p>

        <h2>Visit or reach us</h2>
        <p>
          Call or WhatsApp{' '}
          <a href="tel:+919382828484">+91 93828 28484</a>, email{' '}
          <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a>, or visit us
          at New Bus Stand Area, Sangareddy, Telangana. See our{' '}
          <Link href="/contact">contact page</Link> for more.
        </p>
      </div>
    </div>
  );
}
