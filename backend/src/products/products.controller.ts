import {
  Controller, Get, Post, Put, Body, Param, Query, UseGuards, Request,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  // ─── TAX (static routes first) ───────────────────────
  @Post('tax/seed')
  seedTaxes(@Request() req: any) { return this.productsService.seedTaxes(req.user.businessId); }

  @Get('taxes')
  getTaxes(@Request() req: any) { return this.productsService.getTaxes(req.user.businessId); }

  // ─── BRANDS ──────────────────────────────────────────
  @Get('brands')
  getBrands(@Request() req: any) { return this.productsService.getBrands(req.user.businessId); }

  @Post('brands')
  createBrand(@Request() req: any, @Body() body: { name: string; code?: string }) {
    return this.productsService.createBrand(req.user.businessId, body.name, body.code);
  }

  // ─── CATEGORY ────────────────────────────────────────
  @Post('categories')
  createCategory(@Request() req: any, @Body() dto: CreateCategoryDto) {
    return this.productsService.createCategory(req.user.businessId, dto);
  }

  @Get('categories')
  getCategories(@Request() req: any) { return this.productsService.getCategories(req.user.businessId); }

  @Get('categories/flat')
  getCategoriesFlat(@Request() req: any) { return this.productsService.getCategoriesFlat(req.user.businessId); }

  @Get('categories/:id/products')
  getCategoryProducts(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getProductsByCategory(req.user.businessId, id);
  }

  // ─── SEARCH (before :id) ─────────────────────────────
  @Get('search')
  search(@Request() req: any, @Query('q') q: string) {
    return this.productsService.searchProducts(req.user.businessId, q ?? '');
  }

  @Get('search-by-name')
  searchByName(@Request() req: any, @Query('q') q: string) {
    return this.productsService.searchByName(req.user.businessId, q ?? '');
  }

  // ─── PRODUCT CRUD ─────────────────────────────────────
  @Post()
  create(@Request() req: any, @Body() dto: CreateProductDto) {
    return this.productsService.createProduct(req.user.businessId, dto, req.user.id);
  }

  @Get()
  findAll(@Request() req: any, @Query() query: ProductQueryDto) {
    return this.productsService.getProducts(req.user.businessId, query);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getProductById(req.user.businessId, id);
  }

  @Put(':id')
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateProduct(req.user.businessId, id, dto, req.user.id);
  }

  // ─── FEATURE 1: Toggle status ─────────────────────────
  @Put(':id/toggle-status')
  toggleStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('action') action: 'DISABLE' | 'ENABLE',
  ) {
    return this.productsService.toggleStatus(req.user.businessId, id, action, req.user.id);
  }

  // ─── FEATURE 2: Inline tax update ────────────────────
  @Put(':id/tax')
  updateTax(
    @Request() req: any,
    @Param('id') id: string,
    @Body('taxId') taxId: string,
  ) {
    return this.productsService.updateTax(req.user.businessId, id, taxId, req.user.id);
  }
}
