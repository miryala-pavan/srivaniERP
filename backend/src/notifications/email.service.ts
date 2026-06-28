import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const FROM = 'Srivani Stores <orders@srivani.com>';
const SHOP_URL = 'https://shop.srivani.com';
const WA = '919382828484';

const BRAND_GREEN = '#2e7d32';
const BRAND_LIGHT = '#f1f8e9';

const LOGO_B64 = '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';

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
        <td style="background:#ffffff;padding:24px 32px;text-align:center;border-bottom:4px solid ${BRAND_GREEN};">
          <img src="data:image/png;base64,${LOGO_B64}" width="110" height="110" alt="Srivani Stores" style="display:block;margin:0 auto;"/>
          <p style="margin:6px 0 0;font-size:12px;color:#888;letter-spacing:0.3px;">Sangareddy, Telangana</p>
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
        <div style="text-align:center;margin-top:16px;">
          <a href="${SHOP_URL}/order/${order.orderNumber}/review" style="display:inline-block;background:${BRAND_GREEN};color:#fff;font-weight:700;font-size:14px;padding:13px 28px;border-radius:10px;text-decoration:none;margin-bottom:10px;">
            &#11088; Rate Your Order
          </a>
        </div>
        <div style="text-align:center;margin-top:8px;">
          <a href="https://g.page/r/CXZY6ACcJig_EAE/review" style="display:inline-block;color:#4285F4;font-size:12px;text-decoration:underline;">
            Also leave us a Google Review
          </a>
        </div>` : ''}
    `);

    await this.send(
      order.customerEmail,
      `${info.subject} - ${order.orderNumber} | Srivani Stores`,
      html,
    );
  }

  async sendDeliveryConfirmationRequest(order: {
    customerName: string;
    customerEmail: string;
    orderNumber: string;
  }) {
    const confirmUrl = `${SHOP_URL}/order/${order.orderNumber}/confirm`;
    const html = base(`
      <h2 style="margin:0 0 6px;font-size:22px;color:#111;">&#128663; Your order is on its way!</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#555;">
        Hi ${order.customerName}, your Srivani Stores order is out for delivery and should reach you in 30&ndash;60 minutes.
      </p>
      ${orderNumberBadge(order.orderNumber)}
      <p style="margin:20px 0 12px;font-size:14px;color:#333;font-weight:600;">Once you receive your items, please confirm below:</p>
      <div style="text-align:center;margin:0 0 24px;">
        <a href="${confirmUrl}" style="display:inline-block;background:${BRAND_GREEN};color:#fff;font-weight:700;font-size:15px;padding:15px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.3px;">
          &#10003;&nbsp; Yes, I received my order
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
        Any issue with your delivery? <a href="https://wa.me/${WA}" style="color:${BRAND_GREEN};">WhatsApp us</a> and we'll sort it out.<br/>
        After receiving, you can also <a href="${SHOP_URL}/order/${order.orderNumber}/review" style="color:${BRAND_GREEN};">rate your items</a>.
      </p>
    `);

    await this.send(
      order.customerEmail,
      `Your order ${order.orderNumber} is on the way — please confirm receipt`,
      html,
    );
  }
}
