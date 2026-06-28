import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { SubmitReviewsDto } from './dto/submit-reviews.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ADMIN_ROLES = ['SUPER_ADMIN', 'BRANCH_MANAGER', 'FLOOR_SUPERVISOR', 'ACCOUNTS_PERSON'];

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  // Public — customer submits reviews (verified by orderNumber ownership)
  @Post()
  submitReviews(@Body() dto: SubmitReviewsDto) {
    return this.service.submitReviews(dto);
  }

  // Public — product detail page
  @Get('product/:productCode')
  getProductReviews(@Param('productCode') productCode: string) {
    return this.service.getProductReviews(productCode);
  }

  // Public — check which items already reviewed for this order
  @Get('order/:orderNumber/status')
  getOrderReviewStatus(@Param('orderNumber') orderNumber: string) {
    return this.service.getOrderReviewStatus(orderNumber);
  }

  // ERP staff — all reviews with sentiment breakdown
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Get('admin')
  getAllReviews(@Query('sentiment') sentiment?: string) {
    return this.service.getAllReviews(sentiment);
  }

  // ERP staff — hide/show review
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  @Patch(':id/toggle-published')
  togglePublished(@Param('id') id: string) {
    return this.service.togglePublished(id);
  }
}
