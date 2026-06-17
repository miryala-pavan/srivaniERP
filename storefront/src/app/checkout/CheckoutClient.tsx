'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useVerifiedPhone } from '@/hooks/useVerifiedPhone';
import {
  createOrder,
  verifyRazorpayPayment,
  type CreateOrderPayload,
  type DeliveryType,
  type PaymentMethod,
} from '@/lib/orders';
import { fetchAddresses, createAddress, type SavedAddress } from '@/lib/addresses';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: any) => { open(): void };
  }
}

const DELIVERY_FEE = 40;
const FREE_DELIVERY_ABOVE = 500;
const STORE_ADDRESS = 'Srivani Stores, Shop No. 12, Main Road, Sangareddy — 502001';

function fmt(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

const inp: React.CSSProperties = {
  width: '100%',
  padding: '10px 13px',
  fontSize: '14px',
  border: '1.5px solid var(--line)',
  borderRadius: '10px',
  background: 'var(--paper-2)',
  color: 'var(--ink)',
  outline: 'none',
  boxSizing: 'border-box',
};

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '0.03em' }}>
        {label}{required && <span style={{ color: '#ef4444' }}> *</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: 'var(--ink-soft)', margin: 0 }}>{hint}</p>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--paper-2)',
      border: '1.5px solid var(--line)',
      borderRadius: '16px',
      overflow: 'hidden',
      marginBottom: '16px',
    }}>
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--line)',
        fontSize: '13px',
        fontWeight: 800,
        color: 'var(--ink)',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
      }}>
        {title}
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {children}
      </div>
    </div>
  );
}

function RadioOption({
  selected,
  onClick,
  icon,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px 14px',
        borderRadius: '12px',
        border: `2px solid ${selected ? 'var(--saffron)' : 'var(--line)'}`,
        background: selected ? 'rgba(217,131,36,0.06)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      <span style={{
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--saffron)' : 'var(--line)'}`,
        flexShrink: 0,
        marginTop: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {selected && (
          <span style={{
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: 'var(--saffron)',
          }} />
        )}
      </span>
      <span style={{ flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink)', display: 'block' }}>
          {label}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px', display: 'block' }}>
          {desc}
        </span>
      </span>
    </button>
  );
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.Razorpay === 'function') { resolve(); return; }
    if (document.querySelector('script[src*="razorpay"]')) {
      const wait = setInterval(() => {
        if (typeof window.Razorpay === 'function') { clearInterval(wait); resolve(); }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load payment gateway'));
    document.head.appendChild(script);
  });
}

export default function CheckoutClient() {
  const { items, subtotal, totalItems, clearAll } = useCart();
  const { isLoggedIn, isLoading, user } = useAuth();
  const { verifiedPhone, phoneReady } = useVerifiedPhone();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || !phoneReady) return;
    if (!isLoggedIn) router.replace('/login?redirect=/checkout');
    else if (!verifiedPhone) router.replace('/complete-profile?redirect=/checkout');
    else if (totalItems === 0) router.replace('/cart');
  }, [isLoggedIn, isLoading, verifiedPhone, phoneReady, totalItems, router]);

  // Contact details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Pre-fill from Google account + verified phone
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
    if (verifiedPhone) setPhone(verifiedPhone);
  }, [user, verifiedPhone]);

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [saveAddress, setSaveAddress] = useState(false);

  useEffect(() => {
    if (verifiedPhone) {
      fetchAddresses(verifiedPhone).then(list => {
        setSavedAddresses(list);
        const def = list.find(a => a.isDefault);
        if (def) {
          setAddrLine1(def.line1);
          setAddrLine2(def.line2 ?? '');
          setAddrCity(def.city);
          setAddrPincode(def.pincode);
          setAddrState(def.state);
        }
      }).catch(() => {});
    }
  }, [verifiedPhone]);

  function applyAddress(a: SavedAddress) {
    setAddrLine1(a.line1); setAddrLine2(a.line2 ?? '');
    setAddrCity(a.city); setAddrPincode(a.pincode); setAddrState(a.state);
  }

  // Delivery
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('HOME_DELIVERY');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrCity, setAddrCity] = useState('Sangareddy');
  const [addrPincode, setAddrPincode] = useState('502001');
  const [addrState, setAddrState] = useState('Telangana');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('RAZORPAY');
  const [customerNotes, setCustomerNotes] = useState('');

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const deliveryFee =
    deliveryType === 'STORE_PICKUP'
      ? 0
      : subtotal >= FREE_DELIVERY_ABOVE
        ? 0
        : DELIVERY_FEE;
  const total = subtotal + deliveryFee;

  function validate(): string | null {
    if (!name.trim() || name.trim().length < 2) return 'Please enter your full name';
    if (!/^[6-9]\d{9}$/.test(phone.trim())) return 'Enter a valid 10-digit mobile number (starts with 6-9)';
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return 'Enter a valid email address';
    if (deliveryType === 'HOME_DELIVERY') {
      if (!addrLine1.trim() || addrLine1.trim().length < 5)
        return 'Enter your full delivery address (house/flat, street)';
      if (!addrCity.trim()) return 'Enter your city';
      if (!/^\d{6}$/.test(addrPincode.trim())) return 'Enter a valid 6-digit pincode';
    }
    return null;
  }

  async function handlePlaceOrder() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);

    try {
      const payload: CreateOrderPayload = {
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        deliveryType,
        deliveryAddress:
          deliveryType === 'HOME_DELIVERY'
            ? {
                line1: addrLine1.trim(),
                line2: addrLine2.trim() || undefined,
                city: addrCity.trim(),
                pincode: addrPincode.trim(),
                state: addrState.trim(),
              }
            : undefined,
        paymentMethod,
        items: items.map((it) => ({
          pluBarcode: it.code,
          productCode: it.code.split('-')[0],
          productName: it.name,
          packLabel: it.packLabel,
          quantity: it.qty,
          unitPrice: it.sellingPrice,
        })),
        customerNotes: customerNotes.trim() || undefined,
      };

      const order = await createOrder(payload);

      if (saveAddress && deliveryType === 'HOME_DELIVERY' && verifiedPhone) {
        createAddress({
          phone: verifiedPhone, line1: addrLine1.trim(),
          line2: addrLine2.trim() || undefined,
          city: addrCity.trim(), pincode: addrPincode.trim(), state: addrState.trim(),
          isDefault: savedAddresses.length === 0,
        }).catch(() => {});
      }

      if (paymentMethod === 'COD') {
        clearAll();
        router.push(`/order/${order.orderNumber}`);
        return;
      }

      // Razorpay online payment
      await loadRazorpayScript();

      if (!order.razorpayOrderId) throw new Error('Payment gateway error — please retry');

      const rzp = new window.Razorpay({
        key: order.razorpayKeyId ?? process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
        amount: Math.round(total * 100),
        currency: 'INR',
        name: 'Srivani Stores',
        description: `Order ${order.orderNumber}`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: name.trim(),
          contact: phone.trim(),
          email: email.trim() || '',
        },
        theme: { color: '#D98324' },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setLoading(true);
            const result = await verifyRazorpayPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            clearAll();
            router.push(`/order/${result.orderNumber}`);
          } catch {
            setError('Payment verification failed. Please contact us with your order number.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            setError('Payment was cancelled. You can try again below.');
          },
        },
      });

      rzp.open();
      setLoading(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(msg);
      setLoading(false);
    }
  }

  if (isLoading || !phoneReady) return (
    <div className="wrap">
      <section className="sec" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2"
          aria-hidden="true" style={{ animation: 'spin2 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <style>{`@keyframes spin2 { to { transform: rotate(360deg); } }`}</style>
      </section>
    </div>
  );
  if (!isLoggedIn || totalItems === 0) return null;

  return (
    <div className="wrap">
      <section className="sec" style={{ paddingTop: '28px', paddingBottom: '80px' }}>

        {/* Title */}
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link
            href="/cart"
            title="Go back to cart"
            style={{ color: 'var(--ink-soft)', display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 style={{ fontSize: '22px', fontWeight: 800 }}>Checkout</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: '24px', alignItems: 'start' }}
          className="checkout-grid">

          {/* ── Left column ─────────────────────────────────────────────── */}
          <div>

            {/* 1. Contact */}
            <Card title="1. Contact Details">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-2col">
                <Field label="Full Name" required>
                  <input
                    style={inp}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    title="Enter your full name"
                    autoComplete="name"
                  />
                </Field>
                <Field label="Mobile Number" required hint="10-digit Indian mobile number">
                  <input
                    style={inp}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9XXXXXXXXX"
                    inputMode="numeric"
                    title="Your 10-digit mobile number"
                    autoComplete="tel"
                  />
                </Field>
              </div>
              <Field label="Email Address" hint="Optional — for order confirmation email">
                <input
                  style={inp}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  title="Your email address (optional)"
                  autoComplete="email"
                />
              </Field>
            </Card>

            {/* 2. Delivery */}
            <Card title="2. Delivery Method">
              <RadioOption
                selected={deliveryType === 'HOME_DELIVERY'}
                onClick={() => setDeliveryType('HOME_DELIVERY')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1 3 4 1 4-1 4 1 4-1 4 1v17l-4-1-4 1-4-1-4 1-4-1Z"/><path d="M9 3v18"/><path d="M17 3v18"/></svg>
                }
                label="Home Delivery"
                desc={
                  subtotal >= FREE_DELIVERY_ABOVE
                    ? 'FREE delivery · Your order qualifies!'
                    : `₹${DELIVERY_FEE} delivery fee · Free above ₹${FREE_DELIVERY_ABOVE}`
                }
              />

              {deliveryType === 'HOME_DELIVERY' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '4px' }}>

                  {/* Saved address pills */}
                  {savedAddresses.length > 0 && (
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink-soft)', marginBottom: '8px', letterSpacing: '0.03em' }}>
                        SAVED ADDRESSES
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {savedAddresses.map(a => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => applyAddress(a)}
                            title={`Use: ${a.line1}, ${a.city}`}
                            style={{
                              padding: '7px 12px', borderRadius: '10px', cursor: 'pointer',
                              border: `1.5px solid ${addrLine1 === a.line1 && addrCity === a.city ? 'var(--saffron)' : 'var(--line)'}`,
                              background: addrLine1 === a.line1 && addrCity === a.city ? 'rgba(217,131,36,0.08)' : 'var(--paper-2)',
                              fontSize: '12px', fontWeight: 600,
                              color: addrLine1 === a.line1 && addrCity === a.city ? 'var(--saffron)' : 'var(--ink)',
                              textAlign: 'left',
                            }}
                          >
                            <span style={{ fontWeight: 800 }}>{a.label}</span>
                            <span style={{ color: 'var(--ink-soft)', marginLeft: '4px' }}>
                              {a.line1.slice(0, 20)}{a.line1.length > 20 ? '…' : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Field label="Address Line 1" required hint="House/flat no., building, street">
                    <input style={inp} value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)}
                      placeholder="eg. 12-3, Green Park, MG Road" title="House/flat number and street" autoComplete="address-line1" />
                  </Field>
                  <Field label="Address Line 2" hint="Landmark, area (optional)">
                    <input style={inp} value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)}
                      placeholder="eg. Near Sangareddy Bus Stand" title="Landmark or area" autoComplete="address-line2" />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="form-2col">
                    <Field label="City" required>
                      <input style={inp} value={addrCity} onChange={(e) => setAddrCity(e.target.value)}
                        placeholder="Sangareddy" title="Your city" autoComplete="address-level2" />
                    </Field>
                    <Field label="Pincode" required>
                      <input style={inp} value={addrPincode}
                        onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="502001" inputMode="numeric" title="6-digit pincode" autoComplete="postal-code" />
                    </Field>
                  </div>
                  <Field label="State">
                    <input style={inp} value={addrState} onChange={(e) => setAddrState(e.target.value)}
                      placeholder="Telangana" title="State" autoComplete="address-level1" />
                  </Field>

                  {/* Save address checkbox */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={e => setSaveAddress(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--saffron)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', color: 'var(--ink-soft)', fontWeight: 500 }}>
                      Save this address for future orders
                    </span>
                  </label>
                </div>
              )}

              <RadioOption
                selected={deliveryType === 'STORE_PICKUP'}
                onClick={() => setDeliveryType('STORE_PICKUP')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--leaf)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
                }
                label="Pick Up at Store"
                desc={`FREE · ${STORE_ADDRESS}`}
              />
            </Card>

            {/* 3. Payment */}
            <Card title="3. Payment Method">
              <RadioOption
                selected={paymentMethod === 'RAZORPAY'}
                onClick={() => setPaymentMethod('RAZORPAY')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                }
                label="Pay Online"
                desc="UPI, Cards, Net Banking — powered by Razorpay. Secure & instant."
              />
              <RadioOption
                selected={paymentMethod === 'COD'}
                onClick={() => setPaymentMethod('COD')}
                icon={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--leaf)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z"/><path d="M13 5v14"/></svg>
                }
                label="Cash on Delivery"
                desc="Pay when your order arrives. We'll call to confirm."
              />

              <Field label="Special Instructions" hint="Allergies, delivery time preference, etc.">
                <textarea
                  style={{ ...inp, height: '72px', resize: 'vertical', fontFamily: 'inherit' }}
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Any notes for us? (optional)"
                  title="Special instructions or notes"
                />
              </Field>
            </Card>
          </div>

          {/* ── Right column: Order summary ──────────────────────────────── */}
          <div style={{ position: 'sticky', top: '90px' }}>
            <div style={{
              background: 'var(--paper-2)',
              border: '1.5px solid var(--line)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--line)',
                fontSize: '13px',
                fontWeight: 800,
                color: 'var(--ink)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}>
                Order Summary
              </div>

              {/* Items */}
              <div style={{ maxHeight: '220px', overflowY: 'auto', borderBottom: '1px solid var(--line)' }}>
                {items.map((it) => (
                  <div key={it.code} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 18px',
                    gap: '10px',
                    borderBottom: '1px solid var(--line-2)',
                    fontSize: '12px',
                  }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.name}
                      <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> · {it.packLabel} ×{it.qty}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>₹{fmt(it.sellingPrice * it.qty)}</span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--ink-soft)' }}>
                  <span>Subtotal ({totalItems} item{totalItems !== 1 ? 's' : ''})</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 600 }}>₹{fmt(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--ink-soft)' }}>
                  <span>Delivery</span>
                  {deliveryType === 'STORE_PICKUP' ? (
                    <span style={{ color: 'var(--leaf)', fontWeight: 700 }}>FREE (Pickup)</span>
                  ) : deliveryFee === 0 ? (
                    <span style={{ color: 'var(--leaf)', fontWeight: 700 }}>FREE ✓</span>
                  ) : (
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>₹{deliveryFee}</span>
                  )}
                </div>

                {deliveryType === 'HOME_DELIVERY' && deliveryFee > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--leaf)', margin: 0, lineHeight: 1.4 }}>
                    Add ₹{fmt(FREE_DELIVERY_ABOVE - subtotal)} more for free delivery
                  </p>
                )}

                <div style={{
                  borderTop: '1px solid var(--line)',
                  paddingTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink)' }}>Total</span>
                  <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--ink)' }}>₹{fmt(total)}</span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  margin: '0 18px 14px',
                  padding: '10px 13px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#b91c1c',
                  lineHeight: 1.4,
                }}>
                  {error}
                </div>
              )}

              {/* Place Order Button */}
              <div style={{ padding: '0 18px 18px' }}>
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  title={paymentMethod === 'RAZORPAY' ? 'Pay securely via Razorpay' : 'Place order with Cash on Delivery'}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    borderRadius: '12px',
                    border: 'none',
                    background: loading ? 'var(--line)' : 'var(--saffron)',
                    color: loading ? 'var(--ink-soft)' : '#fff',
                    fontSize: '15px',
                    fontWeight: 800,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'background 0.15s',
                  }}
                >
                  {loading ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      Processing…
                    </>
                  ) : paymentMethod === 'RAZORPAY' ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Pay ₹{fmt(total)}
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z"/></svg>
                      Place COD Order
                    </>
                  )}
                </button>
                <p style={{ fontSize: '11px', color: 'var(--ink-soft)', textAlign: 'center', marginTop: '10px', lineHeight: 1.5 }}>
                  {paymentMethod === 'RAZORPAY'
                    ? '🔒 Secured by Razorpay · Your card details are never stored'
                    : "📞 We'll call you to confirm your COD order"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 700px) {
          .checkout-grid { grid-template-columns: 1fr !important; }
          .form-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
