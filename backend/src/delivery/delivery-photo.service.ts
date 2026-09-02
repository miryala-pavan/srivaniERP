import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { DeliverySettingsService } from './delivery-settings.service';

const API_PUBLIC_URL = (process.env.API_PUBLIC_URL ?? 'http://localhost:4001').replace(/\/$/, '');

/**
 * Delivery-confirmation photo capture. Watermarking happens here, server-side,
 * burning in the SERVER's received timestamp (not the rider's phone clock,
 * which could be wrong or deliberately altered) plus the rider's last-known
 * GPS coordinate — see the feature plan's "Key architecture decisions" for
 * why this can't be done client-side.
 */
@Injectable()
export class DeliveryPhotoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: DeliverySettingsService,
  ) {}

  private get photosDir(): string {
    return process.env.ORDER_PHOTOS_DIR ?? path.join(process.cwd(), '..', 'storage', 'order-photos');
  }

  async upload(businessId: string, deliveryId: string, deliveryBoyId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    const delivery = await this.prisma.delivery.findFirst({ where: { id: deliveryId, businessId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== 'ASSIGNED' || delivery.assignedToId !== deliveryBoyId) {
      throw new ForbiddenException('This delivery is not currently assigned to you');
    }

    const rider = await this.prisma.deliveryBoy.findUnique({ where: { id: deliveryBoyId } });
    const lat = rider?.lastLat ?? delivery.deliveryLat;
    const lng = rider?.lastLng ?? delivery.deliveryLng;
    const capturedAt = new Date();

    const watermarked = await this.applyWatermark(file.buffer, capturedAt, lat, lng);

    const token = randomBytes(5).toString('hex').toUpperCase();
    const filename = `${token}.jpg`;
    fs.mkdirSync(this.photosDir, { recursive: true });
    fs.writeFileSync(path.join(this.photosDir, filename), watermarked);
    const imageUrl = `/uploads/order-photos/${filename}`;

    const settings = await this.settings.getAll(businessId);
    const expiresAt = new Date(Date.now() + settings.photoRetentionDays * 24 * 60 * 60 * 1000);

    const photo = await this.prisma.orderPhoto.create({
      data: {
        businessId,
        customerId: delivery.customerId,
        deliveryId,
        deliveryBoyId,
        token,
        imageUrl,
        watermarked: true,
        lat, lng,
        expiresAt,
      },
    });

    return { id: photo.id, token: photo.token, imageUrl: `${API_PUBLIC_URL}${imageUrl}`, expiresAt };
  }

  private async applyWatermark(buffer: Buffer, capturedAt: Date, lat: number, lng: number): Promise<Buffer> {
    const image = sharp(buffer).rotate(); // .rotate() with no args auto-orients from EXIF before we strip it
    const meta = await image.metadata();
    const width = meta.width ?? 800;

    // Two lines, font scaled to width — a single long line (timestamp +
    // coordinates) silently clips off-canvas on narrower captures since SVG
    // <text> doesn't wrap or shrink on its own (caught by testing against a
    // 400px image, where the longitude was getting cut off entirely).
    const fontSize = Math.max(13, Math.min(20, Math.round(width / 26)));
    const lineHeight = fontSize * 1.4;
    const barHeight = lineHeight * 2 + fontSize * 0.6;
    const line1 = `${capturedAt.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    const line2 = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const svg = `<svg width="${width}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)"/>
      <text x="12" y="${lineHeight}" font-size="${fontSize}" fill="white" font-family="sans-serif">${escapeXml(line1)}</text>
      <text x="12" y="${lineHeight * 2}" font-size="${fontSize}" fill="white" font-family="sans-serif">${escapeXml(line2)}</text>
    </svg>`;

    return image
      .composite([{ input: Buffer.from(svg), gravity: 'south' }])
      .jpeg({ quality: 85 })
      .toBuffer();
  }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
}
