import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const FROM = 'Srivani Stores <orders@srivani.com>';
const SHOP_URL = 'https://shop.srivani.com';
const WA = '919382828484';

const BRAND_GREEN = '#2e7d32';
const BRAND_LIGHT = '#f1f8e9';

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Srivani Stores</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

      <!-- Header -->
      <tr>
        <td style="background:${BRAND_GREEN};padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">&#127981; Srivani Stores</span><br/>
          <span style="font-size:12px;color:#c8e6c9;margin-top:4px;display:inline-block;">Sangareddy, Telangana</span>
        </td>
      </tr>

      <!-- Content -->
      <tr><td style="padding:32px;">
        ${content}
      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#fafafa;border-top:1px solid #eee;padding:20px 32px;text-align:center;">
          <p style="margin:0 0 8px;font-size:12px;color:#666;">
            Questions? <a href="https://wa.me/${WA}" style="color:${BRAND_GREEN};font-weight:600;">WhatsApp us</a> or visit <a href="${SHOP_URL}" style="color:${BRAND_GREEN};">shop.srivani.com</a>
          </p>
          <p style="margin:0;font-size:11px;color:#aaa;">&#169; Srivani Stores, Sangareddy &middot; This is a transactional email</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function orderNumberBadge(orderNumber: string): string {
  return `<div style="display:inline-block;background:${BRAND_LIGHT};border:1px solid #c5e1a5;border-radius:8px;padding:6px 14px;font-size:13px;color:#333;margin-bottom:20px;">
    Order <strong style="font-family:monospace;letter-spacing:0.05em;">${orderNumber}</strong>
  </div>`;
}

function itemsTable(items: { productName: string; packLabel: string; quantity: number; unitPrice: number; total: number }[]): string {
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">
        <strong>${i.productName}</strong><br/>
        <span style="color:#888;font-size:11px;">${i.packLabel} x ${i.quantity}</span>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;text-align:right;white-space:nowrap;">
        Rs.${Number(i.total).toFixed(2)}
      </td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">${rows}</table>`;
}

function totalsBlock(subtotal: number, deliveryFee: number, total: number): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
    <tr>
      <td style="font-size:13px;color:#888;padding:4px 0;">Subtotal</td>
      <td style="font-size:13px;color:#333;text-align:right;">Rs.${subtotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="font-size:13px;color:#888;padding:4px 0;">Delivery</td>
      <td style="font-size:13px;color:${deliveryFee === 0 ? BRAND_GREEN : '#333'};text-align:right;font-weight:${deliveryFee === 0 ? '700' : '400'};">${deliveryFee === 0 ? 'FREE' : `Rs.${deliveryFee.toFixed(2)}`}</td>
    </tr>
    <tr>
      <td style="font-size:16px;font-weight:800;color:#111;padding:10px 0 4px;border-top:2px solid #eee;">Total</td>
      <td style="font-size:16px;font-weight:800;color:#111;text-align:right;padding:10px 0 4px;border-top:2px solid #eee;">Rs.${total.toFixed(2)}</td>
    </tr>
  </table>`;
}

function trackBtn(orderNumber: string): string {
  return `<div style="text-align:center;margin-top:24px;">
    <a href="${SHOP_URL}/order/${orderNumber}" style="display:inline-block;background:${BRAND_GREEN};color:#fff;font-weight:700;font-size:14px;padding:13px 32px;border-radius:10px;text-decoration:none;">
      Track Your Order
    </a>
  </div>`;
}

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter | null;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const host = process.env.SMTP_HOST ?? 'smtp.hostinger.com';
    const port = parseInt(process.env.SMTP_PORT ?? '465', 10);

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log(`Email service ready — sending from ${user}`);
    } else {
      this.transporter = null;
      this.logger.warn('SMTP_USER/SMTP_PASS not set — emails disabled');
    }
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.transporter || !to) return;
    try {
      await this.transporter.sendMail({ from: FROM, to, subject, html });
    } catch (err) {
      this.logger.error(`Email send failed to ${to}: ${(err as Error).message}`);
    }
  }

  async sendOrderPlaced(order: {
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    paymentMethod: string;
    deliveryType: string;
    subtotal: number;
    deliveryFee: number;
    total: number;
    items: { productName: string; packLabel: string; quantity: number; unitPrice: number; total: number }[];
  }) {
    const isCOD = order.paymentMethod === 'COD';
    const isPickup = order.deliveryType === 'STORE_PICKUP';

    const html = base(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#111;">Order Received! &#127881;</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#555;">
        Hi ${order.customerName}, we've received your order and ${isCOD ? 'will call you to confirm soon.' : 'are waiting for payment confirmation.'}
      </p>
      ${orderNumberBadge(order.orderNumber)}
      <div style="background:${BRAND_LIGHT};border-radius:8px;padding:14px 18px;font-size:13px;color:#444;margin-bottom:20px;">
        <strong>Payment:</strong> ${isCOD ? 'Cash on Delivery' : 'Online (Razorpay)'} &nbsp;&middot;&nbsp;
        <strong>Delivery:</strong> ${isPickup ? 'Store Pickup' : 'Home Delivery'}
      </div>
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Items Ordered</p>
      ${itemsTable(order.items)}
      ${totalsBlock(order.subtotal, order.deliveryFee, order.total)}
      ${trackBtn(order.orderNumber)}
    `);

    await this.send(
      order.customerEmail,
      `Order Received - ${order.orderNumber} | Srivani Stores`,
      html,
    );
  }

  async sendPaymentConfirmed(order: {
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    total: number;
  }) {
    const html = base(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#111;">Payment Received &#9989;</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#555;">
        Hi ${order.customerName}, your payment of <strong>Rs.${order.total.toFixed(2)}</strong> was successful. We're preparing your order now.
      </p>
      ${orderNumberBadge(order.orderNumber)}
      ${trackBtn(order.orderNumber)}
    `);

    await this.send(
      order.customerEmail,
      `Payment Confirmed - ${order.orderNumber} | Srivani Stores`,
      html,
    );
  }

  async sendStatusUpdate(order: {
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    status: string;
    deliveryType?: string;
  }) {
    const messages: Record<string, { subject: string; heading: string; body: string; icon: string }> = {
      CONFIRMED: {
        icon: '&#9989;', subject: 'Order Confirmed',
        heading: 'Your order is confirmed!',
        body: 'Great news — your order is confirmed and we are preparing it.',
      },
      PROCESSING: {
        icon: '&#128230;', subject: 'Order Being Packed',
        heading: "We're packing your order",
        body: 'Your items are being carefully packed and will be ready soon.',
      },
      READY: {
        icon: '&#128640;', subject: 'Order Ready',
        heading: order.deliveryType === 'HOME_DELIVERY' ? 'Your order is on the way!' : 'Ready for pickup!',
        body: order.deliveryType === 'HOME_DELIVERY'
          ? 'Your order is out for delivery. Expected in 30-60 mins.'
          : 'Your order is ready. Please collect it from our store in Sangareddy.',
      },
      DELIVERED: {
        icon: '&#127881;', subject: 'Order Delivered',
        heading: 'Order delivered - enjoy!',
        body: "Your order has been delivered. Thank you for shopping with Srivani Stores! We'd love a Google review if you have a moment.",
      },
      CANCELLED: {
        icon: '&#10060;', subject: 'Order Cancelled',
        heading: 'Order cancelled',
        body: 'Your order has been cancelled. If you paid online, a refund will be processed in 5-7 working days.',
      },
    };

    const info = messages[order.status];
    if (!info) return;

    const html = base(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#111;">${info.icon} ${info.heading}</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#555;">
        Hi ${order.customerName}, ${info.body}
      </p>
      ${orderNumberBadge(order.orderNumber)}
      ${order.status !== 'CANCELLED' ? trackBtn(order.orderNumber) : ''}
      ${order.status === 'DELIVERED' ? `
        <div style="text-align:center;margin-top:12px;">
          <a href="https://g.page/r/CXZY6ACcJig_EAE/review" style="display:inline-block;background:#4285F4;color:#fff;font-weight:700;font-size:13px;padding:11px 24px;border-radius:10px;text-decoration:none;">
            Leave a Google Review &#11088;
          </a>
        </div>` : ''}
    `);

    await this.send(
      order.customerEmail,
      `${info.subject} - ${order.orderNumber} | Srivani Stores`,
      html,
    );
  }
}
