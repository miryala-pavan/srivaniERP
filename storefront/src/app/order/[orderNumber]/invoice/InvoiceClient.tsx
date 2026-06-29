'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { OnlineOrder } from '@/lib/orders';

function fmt(n: number | string) {
  const v = Number(n);
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function InvoiceClient({
  order,
  orderNumber,
}: {
  order: OnlineOrder | null;
  orderNumber: string;
}) {
  useEffect(() => {
    if (order) {
      // small delay so CSS renders before print dialog
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [order]);

  if (!order) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 24px' }}>
        <p style={{ fontSize: '18px', color: '#666' }}>Order not found: {orderNumber}</p>
        <Link href="/" style={{ color: '#D98324', fontWeight: 700 }}>← Back to Shop</Link>
      </div>
    );
  }

  const addr = order.deliveryAddress
    ? [
        (order.deliveryAddress as { line1?: string }).line1,
        (order.deliveryAddress as { line2?: string }).line2,
        (order.deliveryAddress as { city?: string }).city,
        (order.deliveryAddress as { pincode?: string }).pincode,
      ].filter(Boolean).join(', ')
    : order.deliveryType === 'STORE_PICKUP'
    ? 'Store Pickup — Shop No. 12, Main Road, Sangareddy'
    : '—';

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          .invoice-wrap { box-shadow: none !important; border: none !important; }
        }
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; }
        .invoice-wrap {
          max-width: 680px;
          margin: 32px auto;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 16px rgba(0,0,0,.10);
          overflow: hidden;
        }
        .inv-header {
          background: #1a1a1a;
          color: #fff;
          padding: 28px 32px 20px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .inv-body { padding: 24px 32px; }
        .inv-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
        .inv-table th { background: #f8f8f8; padding: 9px 12px; text-align: left; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: #666; border-bottom: 2px solid #eee; }
        .inv-table td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
        .inv-table tr:last-child td { border-bottom: none; }
        .inv-totals { border-top: 2px solid #eee; padding-top: 14px; }
        .inv-total-row { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; color: #444; }
        .inv-total-row.grand { font-size: 17px; font-weight: 800; color: #1a1a1a; border-top: 1.5px solid #ddd; padding-top: 10px; margin-top: 6px; }
        .inv-footer { background: #f8f8f8; padding: 16px 32px; font-size: 12px; color: #888; text-align: center; }
        .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #999; margin-bottom: 6px; }
        .info-val { font-size: 14px; color: #1a1a1a; font-weight: 500; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #d1fae5; color: #065f46; }
      `}</style>

      {/* Print/back toolbar */}
      <div className="no-print" style={{
        background: '#1a1a1a', padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <Link href={`/order/${order.orderNumber}`} style={{
          color: '#ccc', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          ← Back to Order
        </Link>
        <button onClick={() => window.print()} style={{
          marginLeft: 'auto', padding: '8px 20px', borderRadius: '8px',
          background: '#D98324', color: '#fff', border: 'none',
          fontSize: '13px', fontWeight: 700, cursor: 'pointer',
        }}>
          🖨️ Print / Save PDF
        </button>
      </div>

      <div className="invoice-wrap">
        {/* Header */}
        <div className="inv-header">
          <div>
            <div style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.5px' }}>Srivani Stores</div>
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Shop No. 12, Main Road, Sangareddy — 502001</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>Ph: +91 93828 28484 | srivani.com</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#888', letterSpacing: '.06em', textTransform: 'uppercase' }}>Invoice / Receipt</div>
            <div style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'monospace', marginTop: '6px', color: '#fff' }}>
              {order.orderNumber}
            </div>
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
              {formatDate(order.createdAt)}
            </div>
          </div>
        </div>

        <div className="inv-body">
          {/* Customer & delivery info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1.5px solid #eee' }}>
            <div>
              <div className="section-label">Billed To</div>
              <div className="info-val">{order.customerName}</div>
              <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>{order.customerPhone}</div>
              {order.customerEmail && (
                <div style={{ fontSize: '13px', color: '#555' }}>{order.customerEmail}</div>
              )}
            </div>
            <div>
              <div className="section-label">Delivery Address</div>
              <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.5 }}>{addr}</div>
            </div>
            <div>
              <div className="section-label">Payment</div>
              <div className="info-val">
                {order.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online (Razorpay)'}
              </div>
              <span className="badge" style={{
                marginTop: '4px',
                background: order.paymentStatus === 'PAID' ? '#d1fae5' : '#fef3c7',
                color: order.paymentStatus === 'PAID' ? '#065f46' : '#92400e',
              }}>
                {order.paymentStatus === 'PAID' ? 'Paid' : order.paymentStatus === 'FAILED' ? 'Failed' : 'Pending'}
              </span>
            </div>
            <div>
              <div className="section-label">Status</div>
              <div className="info-val">{order.status.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* Items */}
          <table className="inv-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Item</th>
                <th style={{ width: '20%' }}>Pack</th>
                <th style={{ textAlign: 'center' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Rate</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.productName}</td>
                  <td style={{ color: '#666' }}>{item.packLabel}</td>
                  <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>₹{fmt(item.unitPrice)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="inv-totals">
            <div className="inv-total-row">
              <span>Subtotal</span>
              <span style={{ fontWeight: 600 }}>₹{fmt(order.subtotal)}</span>
            </div>
            <div className="inv-total-row">
              <span>Delivery Fee</span>
              <span style={{ fontWeight: 600, color: Number(order.deliveryFee) === 0 ? '#059669' : undefined }}>
                {Number(order.deliveryFee) === 0 ? 'FREE' : `₹${fmt(order.deliveryFee)}`}
              </span>
            </div>
            <div className="inv-total-row grand">
              <span>Total</span>
              <span>₹{fmt(order.total)}</span>
            </div>
          </div>

          {order.customerNotes && (
            <div style={{ marginTop: '20px', padding: '14px', background: '#fef9ec', borderRadius: '8px', fontSize: '13px', color: '#555' }}>
              <strong>Notes:</strong> {order.customerNotes}
            </div>
          )}
        </div>

        <div className="inv-footer">
          <p style={{ margin: '0 0 4px' }}>Thank you for shopping with Srivani Stores — Serving Sangareddy for 45+ years! 🙏</p>
          <p style={{ margin: 0 }}>For queries: WhatsApp +91 93828 28484 | shop.srivani.com</p>
        </div>
      </div>
    </>
  );
}
