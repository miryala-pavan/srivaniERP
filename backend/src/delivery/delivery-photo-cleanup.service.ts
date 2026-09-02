import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

const TICK_MS = 24 * 60 * 60 * 1000; // once a day is enough for a day-granularity retention window
const STARTUP_DELAY_MS = 30_000; // let the app finish booting before the first sweep

/**
 * Deletes delivery-confirmation photo FILES past their configured retention
 * window, but keeps the OrderPhoto row (imageUrl cleared) as an audit stub —
 * same setInterval shape as the other schedulers in this codebase.
 */
@Injectable()
export class DeliveryPhotoCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryPhotoCleanupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.startupTimer = setTimeout(() => void this.tick(), STARTUP_DELAY_MS);
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.logger.log(`Delivery photo cleanup sweep scheduled (interval ${TICK_MS / 60000}min)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
  }

  private get photosDir(): string {
    return process.env.ORDER_PHOTOS_DIR ?? path.join(process.cwd(), '..', 'storage', 'order-photos');
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.sweep();
    } catch (err) {
      this.logger.error(`Photo cleanup sweep failed, will retry next cycle: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async sweep(): Promise<void> {
    const expired = await this.prisma.orderPhoto.findMany({
      where: { expiresAt: { lte: new Date() }, imageUrl: { not: '' } },
    });
    if (!expired.length) return;

    for (const photo of expired) {
      const filename = photo.imageUrl.split('/').pop();
      if (filename) {
        const filePath = path.join(this.photosDir, filename);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
          this.logger.error(`Failed to delete expired photo file ${filePath}: ${err instanceof Error ? err.message : err}`);
          continue; // keep the row/URL intact so this is retried next sweep
        }
      }
      await this.prisma.orderPhoto.update({ where: { id: photo.id }, data: { imageUrl: '' } });
    }
    this.logger.log(`Deleted ${expired.length} expired delivery photo file(s)`);
  }
}
