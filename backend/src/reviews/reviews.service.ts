import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitReviewsDto } from './dto/submit-reviews.dto';
import { OnlineOrderStatus } from '@prisma/client';

function analyzeSentiment(rating: number, comment?: string): { sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'; sentimentScore: number } {
  // Base score: rating 1–5 mapped to -2..+2
  let score = rating - 3;

  if (comment && comment.trim().length > 3) {
    const lower = comment.toLowerCase();
    const positives = ['good', 'great', 'excellent', 'fresh', 'love', 'loved', 'perfect', 'best',
      'amazing', 'happy', 'satisfied', 'fast', 'quick', 'quality', 'nice', 'helpful',
      'clean', 'tasty', 'delicious', 'recommend', 'thank', 'awesome', 'superb', 'value', 'genuine'];
    const negatives = ['bad', 'poor', 'worst', 'stale', 'late', 'delay', 'damaged', 'missing',
      'wrong', 'unhappy', 'disappointed', 'slow', 'dirty', 'rude', 'broken', 'waste',
      'never', 'horrible', 'terrible', 'awful', 'disgusting', 'spoiled', 'expired', 'expire'];

    positives.forEach(w => { if (lower.includes(w)) score += 0.3; });
    negatives.forEach(w => { if (lower.includes(w)) score -= 0.3; });
  }

  const clamped = Math.max(-2, Math.min(2, score));
  const sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' =
    clamped > 0.2 ? 'POSITIVE' : clamped < -0.2 ? 'NEGATIVE' : 'NEUTRAL';
  return { sentiment, sentimentScore: Math.round(clamped * 10) / 10 };
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBusinessId(): Promise<string> {
    const biz = await this.prisma.business.findFirst({ where: { isActive: true }, select: { id: true } });
    if (!biz) throw new NotFoundException('Store not configured');
    return biz.id;
  }

  async submitReviews(dto: SubmitReviewsDto) {
    if (!dto.reviews?.length) throw new BadRequestException('No reviews provided');

    const order = await this.prisma.onlineOrder.findUnique({
      where: { orderNumber: dto.orderNumber },
      select: { businessId: true, status: true, customerName: true, customerPhone: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OnlineOrderStatus.DELIVERED) {
      throw new BadRequestException('Reviews can only be submitted after delivery');
    }

    let submitted = 0;
    for (const r of dto.reviews) {
      if (r.rating < 1 || r.rating > 5) continue;
      const { sentiment, sentimentScore } = analyzeSentiment(r.rating, r.comment);
      try {
        await this.prisma.productReview.upsert({
          where: { orderNumber_productCode: { orderNumber: dto.orderNumber, productCode: r.productCode } },
          update: { rating: r.rating, comment: r.comment ?? null, sentiment, sentimentScore },
          create: {
            businessId:    order.businessId,
            orderNumber:   dto.orderNumber,
            productCode:   r.productCode,
            productName:   r.productName,
            packLabel:     r.packLabel,
            customerName:  order.customerName,
            customerPhone: order.customerPhone,
            rating:        r.rating,
            comment:       r.comment ?? null,
            sentiment,
            sentimentScore,
          },
        });
        submitted++;
      } catch { /* duplicate key — skip silently */ }
    }

    return { success: true, submitted };
  }

  async getProductReviews(productCode: string) {
    const businessId = await this.getBusinessId();
    const reviews = await this.prisma.productReview.findMany({
      where: { businessId, productCode, isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { customerName: true, rating: true, comment: true, sentiment: true, createdAt: true },
    });
    const count = reviews.length;
    const avg = count > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
      : 0;
    return { avg, count, reviews };
  }

  async getOrderReviewStatus(orderNumber: string) {
    const done = await this.prisma.productReview.findMany({
      where: { orderNumber },
      select: { productCode: true },
    });
    return { reviewedProductCodes: done.map(r => r.productCode) };
  }

  async getAllReviews(sentiment?: string) {
    const businessId = await this.getBusinessId();
    const where: any = { businessId };
    if (sentiment) where.sentiment = sentiment;

    const reviews = await this.prisma.productReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const counts = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0, total: reviews.length };
    reviews.forEach(r => { if (r.sentiment) (counts as any)[r.sentiment]++; });

    return { reviews, sentimentCounts: counts };
  }

  async togglePublished(id: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    const updated = await this.prisma.productReview.update({
      where: { id },
      data: { isPublished: !review.isPublished },
    });
    return { id, isPublished: updated.isPublished };
  }
}
