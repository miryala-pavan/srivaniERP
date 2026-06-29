import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../notifications/whatsapp.service';
import { SubscribeStockAlertDto } from './dto/subscribe.dto';

const SHOP_URL = process.env.SHOP_URL ?? 'https://shop.srivani.com';

@Injectable()
export class StockAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  async subscribe(dto: SubscribeStockAlertDto) {
    if (!dto.phone && !dto.email) {
      throw new BadRequestException('Phone or email is required');
    }

    const businessId = await this.getBusinessId();

    // Upsert: don't duplicate if already subscribed
    await this.prisma.stockAlert.upsert({
      where: {
        pluBarcode_phone: {
          pluBarcode: dto.pluBarcode,
          phone: dto.phone ?? '',
        },
      },
      update: {
        email: dto.email ?? null,
        productName: dto.productName,
        packLabel: dto.packLabel,
        notifiedAt: null, // reset so they get notified again if re-subscribed
      },
      create: {
        businessId,
        pluBarcode: dto.pluBarcode,
        productName: dto.productName,
        packLabel: dto.packLabel,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
      },
    });

    return { success: true, message: "You'll be notified when this item is back in stock!" };
  }

  async notifySubscribers(pluBarcode: string, productUrl?: string) {
    const alerts = await this.prisma.stockAlert.findMany({
      where: { pluBarcode, notifiedAt: null },
    });

    if (!alerts.length) return { notified: 0 };

    const url = productUrl ?? SHOP_URL;
    let notified = 0;

    for (const alert of alerts) {
      try {
        if (alert.phone) {
          await this.whatsapp.sendBackInStock({
            customerPhone: alert.phone,
            customerName: alert.phone, // name not stored; phone is the identifier
            productName: alert.productName,
            packLabel: alert.packLabel,
            productUrl: url,
          });
        }
        await this.prisma.stockAlert.update({
          where: { id: alert.id },
          data: { notifiedAt: new Date() },
        });
        notified++;
      } catch {
        // continue with others on failure
      }
    }

    return { notified };
  }
}
