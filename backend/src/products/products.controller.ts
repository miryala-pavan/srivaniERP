import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request,
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
  getCategories(@Request() req: any, @Query('departmentId') deptId?: string) {
    return this.productsService.getCategories(req.user.businessId, deptId);
  }

  @Get('categories/flat')
  getCategoriesFlat(@Request() req: any) { return this.productsService.getCategoriesFlat(req.user.businessId); }

  @Patch('categories/:id')
  updateCategory(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; isActive?: boolean; departmentId?: string },
  ) {
    return this.productsService.updateCategory(req.user.businessId, id, body);
  }

  @Delete('categories/:id')
  deleteCategory(@Request() req: any, @Param('id') id: string) {
    return this.productsService.deleteCategory(req.user.businessId, id);
  }

  @Get('categories/:id/products')
  getCategoryProducts(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getProductsByCategory(req.user.businessId, id);
  }

  // ─── SUB-CATEGORIES ───────────────────────────────────
  @Post('subcategories')
  createSubCategory(
    @Request() req: any,
    @Body() body: { name: string; categoryId: string; sortOrder?: number },
  ) {
    return this.productsService.createSubCategory(req.user.businessId, body);
  }

  @Get('subcategories')
  getSubCategories(
    @Request() req: any,
    @Query('categoryId') categoryId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.productsService.getSubCategories(req.user.businessId, categoryId, departmentId);
  }

  @Patch('subcategories/:id')
  updateSubCategory(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; sortOrder?: number; isActive?: boolean; categoryId?: string },
  ) {
    return this.productsService.updateSubCategory(req.user.businessId, id, body);
  }

  @Delete('subcategories/:id')
  deleteSubCategory(@Request() req: any, @Param('id') id: string) {
    return this.productsService.deleteSubCategory(req.user.businessId, id);
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

  // ─── PLU MANAGEMENT ───────────────────────────────────
  @Get(':id/plus')
  getPlus(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getPlusForProduct(req.user.businessId, id);
  }

  @Get(':id/plus/active')
  getActivePlus(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getActivePlusForProduct(req.user.businessId, id);
  }

  @Post(':id/plus')
  createPlu(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      eanCode?: string; basicCost?: number; costPrice?: number;
      mrp: number; sellingPrice: number; wholesalePrice?: number;
      minSellingPrice?: number; gstRate?: number; hsnCode?: string;
      cessRate?: number; taxInclusive?: boolean; openingStock?: number;
    },
  ) {
    return this.productsService.createPlu(req.user.businessId, id, body);
  }

  @Patch(':id/plus/:pluId')
  updatePlu(
    @Request() req: any,
    @Param('id') id: string,
    @Param('pluId') pluId: string,
    @Body() body: {
      eanCode?: string; sellingPrice?: number; wholesalePrice?: number;
      minSellingPrice?: number; gstRate?: number; cessRate?: number; taxInclusive?: boolean;
    },
  ) {
    return this.productsService.updatePlu(req.user.businessId, id, pluId, body);
  }

  @Post(':id/plus/:pluId/set-default')
  setDefaultPlu(
    @Request() req: any,
    @Param('id') id: string,
    @Param('pluId') pluId: string,
  ) {
    return this.productsService.setDefaultPlu(req.user.businessId, id, pluId);
  }

  @Post(':id/plus/:pluId/deactivate')
  deactivatePlu(
    @Request() req: any,
    @Param('id') id: string,
    @Param('pluId') pluId: string,
    @Body() body: { reason?: string },
  ) {
    return this.productsService.deactivatePlu(req.user.businessId, id, pluId, body?.reason);
  }
}
