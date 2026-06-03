import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { canViewCost } from '../common/helpers/cost-visibility';

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
    @Body() body: { name: string; categoryId: string; sortOrder?: number; hsnCode?: string },
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
    @Body() body: { name?: string; sortOrder?: number; isActive?: boolean; categoryId?: string; hsnCode?: string | null },
  ) {
    return this.productsService.updateSubCategory(req.user.businessId, id, body);
  }

  @Delete('subcategories/:id')
  deleteSubCategory(@Request() req: any, @Param('id') id: string) {
    return this.productsService.deleteSubCategory(req.user.businessId, id);
  }

  // ─── HSN MANAGEMENT ───────────────────────────────────
  @Get('hsn/stats')
  getHsnStats(@Request() req: any) {
    return this.productsService.getHsnStats(req.user.businessId);
  }

  @Post('hsn/apply/:subcategoryId')
  applyHsn(
    @Request() req: any,
    @Param('subcategoryId') subcategoryId: string,
    @Body() body: { hsnCode: string; mode: 'ALL' | 'UNSET_ONLY' },
  ) {
    return this.productsService.applyHsnToSubcategory(req.user.businessId, subcategoryId, body.hsnCode, body.mode ?? 'UNSET_ONLY');
  }

  @Post('hsn/bulk-apply')
  bulkApplyHsn(
    @Request() req: any,
    @Body() body: { entries: { subcategoryId: string; hsnCode: string }[]; mode: 'ALL' | 'UNSET_ONLY' },
  ) {
    return this.productsService.bulkApplyHsn(req.user.businessId, body.entries, body.mode ?? 'UNSET_ONLY');
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
    return this.productsService.getProducts(req.user.businessId, query, req.user.role);
  }

  // ─── MULTI-SEGMENT ROUTES (before :id) ───────────────

  @Get(':id/stock-history')
  getStockHistory(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getProductStockHistory(req.user.businessId, id);
  }

  @Get(':id/sales')
  getSales(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { page?: string; limit?: string; dateFrom?: string; dateTo?: string },
  ) {
    return this.productsService.getProductSales(req.user.businessId, id, query);
  }

  @Get(':id/purchases')
  getPurchases(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: { page?: string; limit?: string },
  ) {
    const isOwner = canViewCost(req.user.role);
    return this.productsService.getProductPurchases(req.user.businessId, id, query, isOwner);
  }

  @Get(':id/suppliers')
  getSuppliers(@Request() req: any, @Param('id') id: string) {
    const isOwner = canViewCost(req.user.role);
    return this.productsService.getProductSuppliers(req.user.businessId, id, isOwner);
  }

  // ─── SINGLE-RESOURCE ROUTES ───────────────────────────

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.productsService.getProductById(req.user.businessId, id, req.user.role);
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

  // ─── FEATURE 2: Online visibility toggle ─────────────
  @Put(':id/online-visibility')
  setOnlineVisibility(
    @Request() req: any,
    @Param('id') id: string,
    @Body('online') online: boolean,
  ) {
    return this.productsService.setOnlineVisibility(req.user.businessId, id, online, req.user.id);
  }

  // ─── FEATURE 3: Bulk online visibility ───────────────
  @Put('bulk-online-visibility')
  bulkSetOnlineVisibility(
    @Request() req: any,
    @Body('ids') ids: string[],
    @Body('online') online: boolean,
  ) {
    return this.productsService.bulkSetOnlineVisibility(req.user.businessId, ids, online, req.user.id);
  }

  // ─── FEATURE 4: Inline HSN update ───────────────────
  @Put(':id/hsn')
  updateHsn(
    @Request() req: any,
    @Param('id') id: string,
    @Body('hsnCode') hsnCode: string,
  ) {
    return this.productsService.updateHsn(req.user.businessId, id, hsnCode, req.user.id);
  }

  // ─── FEATURE 5: Inline tax update ────────────────────
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
    return this.productsService.getPlusForProduct(req.user.businessId, id, req.user.role);
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
      availableOnline?: boolean; onlinePrice?: number | null;
      onlineStockCap?: number | null; packLabel?: string | null;
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

  // ─── PLU BUNDLE (Bulk ↔ Single) ──────────────────────
  @Get('plu-bundles/:pluId')
  getPluBundle(@Request() req: any, @Param('pluId') pluId: string) {
    return this.productsService.getPluBundle(req.user.businessId, pluId);
  }

  @Post('plu-bundles')
  createPluBundle(
    @Request() req: any,
    @Body() body: { bulkPluId: string; singlePluId: string; conversionQty: number; notes?: string },
  ) {
    return this.productsService.createPluBundle(req.user.businessId, body);
  }

  @Delete('plu-bundles/:bundleId')
  deletePluBundle(@Request() req: any, @Param('bundleId') bundleId: string) {
    return this.productsService.deletePluBundle(req.user.businessId, bundleId);
  }

  @Post('plu-bundles/break-bulk')
  breakBulk(
    @Request() req: any,
    @Body() body: { bundleId: string; bulkQty: number; notes?: string },
  ) {
    return this.productsService.breakBulk(req.user.businessId, {
      ...body,
      userId:   req.user.id,
      userName: req.user.fullName,
    });
  }

  @Get('plu-bundles/:pluId/history')
  getBreakBulkHistory(@Request() req: any, @Param('pluId') pluId: string) {
    return this.productsService.getBreakBulkHistory(req.user.businessId, pluId);
  }

  // ─── IMAGE ────────────────────────────────────────────
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
  }))
  uploadImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new Error('No file uploaded');
    return this.productsService.uploadProductImage(req.user.businessId, id, file);
  }

  @Delete(':id/image')
  deleteImage(@Request() req: any, @Param('id') id: string) {
    return this.productsService.deleteProductImage(req.user.businessId, id);
  }
}
