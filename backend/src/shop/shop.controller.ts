import { Controller, Get, Post, Param, Query, Request, Res, UseGuards, ForbiddenException, ParseIntPipe, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import type { Response } from 'express';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// NO auth guard — public catalog (except the two admin-only feed-settings
// routes at the bottom, which are individually @UseGuards-protected)

@Controller('shop')
export class ShopController {
  constructor(private shopService: ShopService) {}

  // GET /shop/categories
  @Get('categories')
  getCategories() {
    return this.shopService.getCategories();
  }

  // GET /shop/departments
  @Get('departments')
  getDepartments() {
    return this.shopService.getDepartments();
  }

  // GET /shop/nav-tree — full 3-level hierarchy for mega-menu
  @Get('nav-tree')
  getNavTree() {
    return this.shopService.getNavTree();
  }

  // GET /shop/store-config — storefront reads this at load to know whether
  // to show prices/cart or run browse-only (catalogue mode).
  @Get('store-config')
  getStoreConfig() {
    return this.shopService.getStoreConfig();
  }

  // GET /shop/products?categoryCode=&subCategoryCode=&deptCode=&search=&inStock=&sort=&page=&limit=&minPrice=&maxPrice=
  @Get('products')
  getProducts(
    @Query('categoryCode')    categoryCode?: string,
    @Query('subCategoryCode') subCategoryCode?: string,
    @Query('deptCode')        deptCode?: string,
    @Query('search')          search?: string,
    @Query('sort')            sort?: string,
    @Query('minPrice')        minPrice?: string,
    @Query('maxPrice')        maxPrice?: string,
    @Query('inStock',    new DefaultValuePipe(false), ParseBoolPipe) inStock    = false,
    @Query('dealsOnly',  new DefaultValuePipe(false), ParseBoolPipe) dealsOnly  = false,
    @Query('page',       new DefaultValuePipe(1),     ParseIntPipe)  page       = 1,
    @Query('limit',      new DefaultValuePipe(24),    ParseIntPipe)  limit      = 24,
  ) {
    return this.shopService.getProducts({
      categoryCode, subCategoryCode, deptCode, search, sort, inStock, dealsOnly, page, limit,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
    });
  }

  // GET /shop/products/suggest?q=rice&limit=6
  @Get('products/suggest')
  suggest(
    @Query('q') q = '',
    @Query('limit', new DefaultValuePipe(6), ParseIntPipe) limit = 6,
  ) {
    return this.shopService.suggest(q, limit);
  }

  // GET /shop/products/:code  (must be after /products and suggest)
  @Get('products/:code')
  getProduct(@Param('code') code: string) {
    return this.shopService.getProductByCode(code);
  }

  // GET /shop/frequently-bought-with/:pluBarcode?limit=4
  @Get('frequently-bought-with/:pluBarcode')
  getFrequentlyBoughtWith(
    @Param('pluBarcode') pluBarcode: string,
    @Query('limit', new DefaultValuePipe(4), ParseIntPipe) limit = 4,
  ) {
    return this.shopService.getFrequentlyBoughtWith(pluBarcode, limit);
  }

  // GET /shop/check-pincode/:pincode — checkout serviceability check
  @Get('check-pincode/:pincode')
  checkPincode(@Param('pincode') pincode: string) {
    return this.shopService.checkPincode(pincode);
  }

  // GET /shop/delivery-slots?date=today|tomorrow
  @Get('delivery-slots')
  getDeliverySlots(@Query('date') date?: string) {
    return this.shopService.getDeliverySlots(date === 'tomorrow' ? 'tomorrow' : 'today');
  }

  // ── Meta (Facebook/Instagram) Commerce Catalog data feed ──────────────────

  // GET /shop/meta-catalog-feed.csv?token=<per-business token> — fetched by
  // Meta's own crawler on a schedule the store owner sets in Commerce
  // Manager, not by staff — public route, but gated by an unguessable
  // per-business token instead of the JWT guard used below.
  @Get('meta-catalog-feed.csv')
  async getMetaCatalogFeed(@Query('token') token: string, @Res() res: Response) {
    if (!token) throw new ForbiddenException('Missing feed token');
    const csv = await this.shopService.generateCatalogFeedCsv(token);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csv);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Get('meta-catalog-feed/settings')
  getMetaCatalogFeedSettings(@Request() req: any) {
    return this.shopService.getFeedSettings(req.user.businessId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @Post('meta-catalog-feed/regenerate')
  regenerateMetaCatalogFeed(@Request() req: any) {
    return this.shopService.getFeedUrlAfterRegenerate(req.user.businessId);
  }
}
