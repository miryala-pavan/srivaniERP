import { Controller, Get, Param, Query, ParseIntPipe, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import { ShopService } from './shop.service';

// NO auth guard — public catalog

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

  // GET /shop/products?categoryCode=&subCategoryCode=&deptCode=&search=&inStock=&sort=&page=&limit=
  @Get('products')
  getProducts(
    @Query('categoryCode')    categoryCode?: string,
    @Query('subCategoryCode') subCategoryCode?: string,
    @Query('deptCode')        deptCode?: string,
    @Query('search')          search?: string,
    @Query('sort')            sort?: string,
    @Query('inStock',    new DefaultValuePipe(false), ParseBoolPipe) inStock    = false,
    @Query('dealsOnly',  new DefaultValuePipe(false), ParseBoolPipe) dealsOnly  = false,
    @Query('page',       new DefaultValuePipe(1),     ParseIntPipe)  page       = 1,
    @Query('limit',      new DefaultValuePipe(24),    ParseIntPipe)  limit      = 24,
  ) {
    return this.shopService.getProducts({
      categoryCode, subCategoryCode, deptCode, search, sort, inStock, dealsOnly, page, limit,
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
}
