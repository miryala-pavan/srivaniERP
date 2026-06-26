import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCategories, getProducts } from '@/lib/shop';
import ProductCard from '@/components/ProductCard';

export const metadata: Metadata = {
  title: 'Srivani Stores — Online Grocery in Sangareddy, Telangana',
  description:
    'Order groceries, staples, oils, dals, masalas, dairy & household essentials online. Home delivery in Sangareddy. Sri Vani Kirana & General Stores — trusted since 1983.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Srivani Stores — Online Grocery in Sangareddy, Telangana',
    description:
      'Order groceries online and get home delivery in Sangareddy, Telangana. Pure, Trust & Quality since 1983.',
    url: '/',
  },
};

const FAQ_LD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Where is Srivani Stores located?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sri Vani Kirana & General Stores — also known as Srivani Stores, Srivani Kirana, or Sri Vani Store — is located at New Bus Stand Area, Sangareddy, Telangana 502001. You can also shop online at shop.srivani.com.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Srivani Stores deliver home in Sangareddy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Srivani Stores offers home delivery across Sangareddy, Telangana. Place your order at shop.srivani.com or WhatsApp +91 93828 28484 and we will deliver to your doorstep. Store pickup is also available.',
      },
    },
    {
      '@type': 'Question',
      name: 'What products does Srivani Kirana sell?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Srivani Stores sells a complete range of groceries: rice, atta, maida, dals, pulses, cooking oils, ghee, spices, masalas, dry fruits, cashews, almonds, raisins, sugar, salt, tea, coffee, biscuits, snacks, chips, dairy products, milk powder, soaps, shampoo, detergents and all daily household essentials. We also stock Srivani brand freshly repacked staples.',
      },
    },
    {
      '@type': 'Question',
      name: 'What are the timings of Srivani Kirana store Sangareddy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sri Vani Kirana & General Stores is open Monday to Sunday, 8:00 AM to 9:30 PM. You can also order online anytime at shop.srivani.com.',
      },
    },
    {
      '@type': 'Question',
      name: 'How to order from Srivani Stores online?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can order groceries from Srivani Stores online at shop.srivani.com, or on WhatsApp by messaging +91 93828 28484. We accept UPI, debit card, credit card and cash on delivery.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is Sri Vani and Srivani Stores the same?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Sri Vani Kirana & General Stores, Srivani Stores, Srivani Kirana, and Sri Vani Store are all the same shop — founded by Mr. M. Pandurangam in 1983 at New Bus Stand Area, Sangareddy, Telangana. It is one of the oldest and most trusted grocery stores in Sangareddy.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the phone number for Srivani Stores Sangareddy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You can reach Srivani Stores Sangareddy at +91 93828 28484 by phone or WhatsApp. Email: srivanistore.srd@gmail.com. Address: New Bus Stand Area, Sangareddy, Telangana 502001.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where to buy dry fruits and spices in Sangareddy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Srivani Stores in Sangareddy stocks a wide range of dry fruits (cashews, almonds, raisins, dates, pistachios) and spices (red chilli powder, turmeric, coriander, cumin, garam masala, and more). Order online at shop.srivani.com or visit New Bus Stand Area, Sangareddy.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where to buy rice and groceries in Sangareddy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Srivani Stores, Sangareddy stocks all varieties of rice (Sona Masoori, Basmati, HMT, Kolam, Raw rice, Boiled rice), dals, pulses and all grocery staples at near-wholesale prices. Shop online at shop.srivani.com or visit us at New Bus Stand Area, Sangareddy, Telangana.',
      },
    },
  ],
};

export default async function HomePage() {
  const [categories, featured] = await Promise.all([
    getCategories(),
    getProducts({ limit: 8 }),
  ]);

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <div className="wrap">
        <section className="hero">

          <div className="hero-top">
            {/* Logo */}
            <div className="hero-logo rv d2">
              <Image
                src="/logo.png"
                alt="Srivani Stores"
                width={290}
                height={290}
                priority
                className="hero-logo-img"
                style={{ filter: 'drop-shadow(0 12px 30px rgba(0,0,0,.18))' }}
              />
            </div>

            {/* Rotating seal */}
            <div className="seal-wrap rv d3">
              <div className="seal">
                <svg className="ring" viewBox="0 0 230 230" aria-hidden="true" focusable="false">
                  <defs>
                    <path
                      id="cs-circle"
                      fill="none"
                      d="M115,115 m-92,0 a92,92 0 1,1 184,0 a92,92 0 1,1 -184,0"
                    />
                  </defs>
                  <text>
                    <textPath href="#cs-circle" startOffset="0">
                      PURE · TRUST · QUALITY · SINCE 1983 · PURE · TRUST · QUALITY · SINCE 1983 ·{' '}
                    </textPath>
                  </text>
                </svg>
                <div className="core">
                  <div className="yr">1983</div>
                  <div className="leaf" />
                  <div className="sub">Kirana &amp; General</div>
                </div>
              </div>
            </div>
          </div>

          {/* Copy below logo + seal */}
          <div className="hero-copy">
            <p className="kicker rv d1">Forty-three years of trust</p>
            <h1 className="rv d2">
              Your favourite kirana is<br /><em>now online.</em>
            </h1>
            <p className="lede rv d3">
              The same Pure, Trust &amp; Quality that families in Sangareddy have relied on since
              1983 — now at your fingertips, with home delivery and store pickup.
            </p>
            <div className="ctas rv d4">
              <a
                className="btn btn-pri"
                href="https://wa.me/919382828484?text=Hello%20Sri%20Vani%20Stores%2C%20I%27d%20like%20to%20place%20an%20order."
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm5.7 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.5-1.2-2.9s.7-2 1-2.3c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.1.1-.3.3-.1.6.1.3.7 1.1 1.4 1.8.9.8 1.7 1.1 2 1.2.2.1.4.1.6-.1l.7-.9c.2-.2.4-.2.6-.1l1.9.9c.3.1.5.2.5.4.1.2.1.8-.1 1.4z" />
                </svg>
                Order on WhatsApp
              </a>
              <a className="btn btn-ghost" href="tel:+919382828484">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
                </svg>
                Call 93828 28484
              </a>
            </div>
          </div>

        </section>

        {/* ─── Marquee strip ──────────────────────────────────────────── */}
        <div className="marquee-mini">
          <span>
            Groceries
            <span className="dot" />
            Home Delivery
            <span className="dot" />
            Store Pickup
            <span className="dot" />
            Srivani Repacked Staples
            <span className="dot" />
            Wholesale Prices
          </span>
        </div>

        {/* ─── Browse Products banner ─────────────────────────────────── */}
        <Link href="/products" className="browse-banner">
          <div className="browse-banner-left">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
            <div>
              <p className="browse-banner-title">Browse all products</p>
              <p className="browse-banner-sub">Groceries, oils, dals, masalas, dairy, snacks &amp; more</p>
            </div>
          </div>
          <span className="browse-banner-arrow">
            Shop now &rarr;
          </span>
        </Link>

        {/* ─── What you can do ────────────────────────────────────────── */}
        <section className="sec">
          <p className="eyebrow">What you can do</p>
          <h2>Everything you love about the store —<br />now online.</h2>
          <p>Browse the full range, order on WhatsApp or the site, and get it delivered home — or collect it ready-packed.</p>
          <div className="feat">
            <div className="card">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              </div>
              <h3>Browse thousands of products</h3>
              <p>Search and explore the full store — groceries, oils, dals, masalas, dairy, snacks and more.</p>
            </div>
            <div className="card">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H3v12h11z" /><path d="M14 9h4l3 3v6h-7" /><circle cx="7.5" cy="18.5" r="1.5" /><circle cx="17.5" cy="18.5" r="1.5" /></svg>
              </div>
              <h3>Home delivery</h3>
              <p>Our doorstep tradition since 1983 — your order brought home, fresh and on time.</p>
            </div>
            <div className="card">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
              </div>
              <h3>Store pickup</h3>
              <p>Order online, skip the queue, and collect your bags ready-packed at the counter.</p>
            </div>
            <div className="card">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m7.5 4.3 9 5.2v9L7.5 13.5z" /><path d="M16.5 9.5 7.5 4.3 3 7l9 5.2z" /><path d="M3 7v9.5L12 22v-9.8" /></svg>
              </div>
              <h3>Srivani-brand staples</h3>
              <p>Our own freshly repacked grains, dals, dry fruits &amp; masala — same quality you trust in-store.</p>
            </div>
            <div className="card">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
              </div>
              <h3>Pay your way</h3>
              <p>Secure online payment by UPI or card — or simply pay cash on delivery and pickup.</p>
            </div>
            <div className="card">
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3v18h18" /><path d="m7 14 3-3 3 3 5-5" /></svg>
              </div>
              <h3>Reorder in seconds</h3>
              <p>Track your orders and bring back your regular monthly list with a single tap.</p>
            </div>
          </div>
        </section>

        {/* ─── Shop by aisle — LIVE categories ────────────────────────── */}
        <section className="sec" style={{ paddingTop: 0 }}>
          <p className="eyebrow">Shop by aisle</p>
          <h2>From cosmetics to cashews.</h2>
          <p>The full range you&apos;d find on our shelves — now available online.</p>
          <div className="cats">
            {categories.length > 0 ? (
              <>
                {categories.map(cat => (
                  <Link key={cat.id} href={`/category/${cat.code}`} className="cat">
                    {cat.label || cat.name}
                    <span className="cat-count">({cat.productCount})</span>
                  </Link>
                ))}
              </>
            ) : (
              <span className="cat" style={{ pointerEvents: 'none', opacity: .5 }}>Loading categories…</span>
            )}
          </div>
          <div style={{ marginTop: '28px' }}>
            <Link
              href="/products"
              style={{
                display:       'inline-flex',
                alignItems:    'center',
                gap:           '6px',
                fontSize:      '14px',
                fontWeight:    600,
                color:         'var(--saffron-deep)',
                textDecoration:'none',
                transition:    'gap .2s',
              }}
            >
              Browse all products
              <span aria-hidden="true" style={{ fontSize: '16px' }}>&rarr;</span>
            </Link>
          </div>
        </section>
      </div>

      {/* ─── Heritage band (full-bleed dark) ────────────────────────── */}
      <section className="heritage">
        <div className="wrap">
          <p className="eyebrow">Our story</p>
          <h2>
            A Sangareddy landmark, started in 1983 with{' '}
            <em>&#8377;1,500 and a promise.</em>
          </h2>
          <p>
            Sri Vani Kirana &amp; General Stores was founded by Mr. M. Pandurangam in the heart
            of the New Bus Stand area — the first retail store of its kind in town. Over four
            decades, it became known for one thing above all: giving families every kind of
            general and kirana goods at almost wholesale prices, packed fresh and delivered home.
            That promise hasn&apos;t changed. Now you can shop it online.
          </p>
          <div className="vals">
            <div className="val"><div className="n">1983</div><div className="l">Serving since</div></div>
            <div className="val"><div className="n">Pure</div><div className="l">Sourcing</div></div>
            <div className="val"><div className="n">Trust</div><div className="l">Every order</div></div>
            <div className="val"><div className="n">Quality</div><div className="l">Guaranteed</div></div>
          </div>
        </div>
      </section>

      {/* ─── Featured products — LIVE ─────────────────────────────────── */}
      {featured.data.length > 0 && (
        <div className="wrap">
          <section className="sec">
            <p className="eyebrow">Featured products</p>
            <h2>Fresh picks from our shelves.</h2>
            <div className="products-grid">
              {featured.data.map(product => (
                <ProductCard key={product.code} product={product} />
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ─── Contact / WhatsApp CTA ───────────────────────────────────── */}
      <div className="wrap">
        <section className="sec" style={{ paddingTop: 0 }}>
          <p className="eyebrow">Order today</p>
          <h2>Shop with us now.</h2>
          <p>Call us or message on WhatsApp and we&apos;ll deliver.</p>
          <div style={{ marginTop: '32px' }}>
            <div className="info-row">
              <span className="ic2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
              </span>
              <div>
                <b>Call or WhatsApp</b>
                <a href="tel:+919382828484">+91 93828 28484</a>
              </div>
            </div>
            <div className="info-row">
              <span className="ic2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>
              </span>
              <div>
                <b>Email</b>
                <a href="mailto:srivanistore.srd@gmail.com">srivanistore.srd@gmail.com</a>
              </div>
            </div>
            <div className="info-row">
              <span className="ic2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
              </span>
              <div>
                <b>Visit us</b>
                <span>New Bus Stand Area, Sangareddy, Telangana</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
    </>
  );
}
