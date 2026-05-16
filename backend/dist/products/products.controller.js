"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductsController = void 0;
const common_1 = require("@nestjs/common");
const products_service_1 = require("./products.service");
const create_product_dto_1 = require("./dto/create-product.dto");
const update_product_dto_1 = require("./dto/update-product.dto");
const create_category_dto_1 = require("./dto/create-category.dto");
const product_query_dto_1 = require("./dto/product-query.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
let ProductsController = class ProductsController {
    productsService;
    constructor(productsService) {
        this.productsService = productsService;
    }
    seedTaxes(req) { return this.productsService.seedTaxes(req.user.businessId); }
    getTaxes(req) { return this.productsService.getTaxes(req.user.businessId); }
    getBrands(req) { return this.productsService.getBrands(req.user.businessId); }
    createBrand(req, body) {
        return this.productsService.createBrand(req.user.businessId, body.name, body.code);
    }
    createCategory(req, dto) {
        return this.productsService.createCategory(req.user.businessId, dto);
    }
    getCategories(req) { return this.productsService.getCategories(req.user.businessId); }
    getCategoriesFlat(req) { return this.productsService.getCategoriesFlat(req.user.businessId); }
    getCategoryProducts(req, id) {
        return this.productsService.getProductsByCategory(req.user.businessId, id);
    }
    search(req, q) {
        return this.productsService.searchProducts(req.user.businessId, q ?? '');
    }
    searchByName(req, q) {
        return this.productsService.searchByName(req.user.businessId, q ?? '');
    }
    create(req, dto) {
        return this.productsService.createProduct(req.user.businessId, dto, req.user.id);
    }
    findAll(req, query) {
        return this.productsService.getProducts(req.user.businessId, query);
    }
    findOne(req, id) {
        return this.productsService.getProductById(req.user.businessId, id);
    }
    update(req, id, dto) {
        return this.productsService.updateProduct(req.user.businessId, id, dto, req.user.id);
    }
    toggleStatus(req, id, action) {
        return this.productsService.toggleStatus(req.user.businessId, id, action, req.user.id);
    }
    updateTax(req, id, taxId) {
        return this.productsService.updateTax(req.user.businessId, id, taxId, req.user.id);
    }
};
exports.ProductsController = ProductsController;
__decorate([
    (0, common_1.Post)('tax/seed'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "seedTaxes", null);
__decorate([
    (0, common_1.Get)('taxes'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "getTaxes", null);
__decorate([
    (0, common_1.Get)('brands'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "getBrands", null);
__decorate([
    (0, common_1.Post)('brands'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "createBrand", null);
__decorate([
    (0, common_1.Post)('categories'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_category_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Get)('categories'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('categories/flat'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "getCategoriesFlat", null);
__decorate([
    (0, common_1.Get)('categories/:id/products'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "getCategoryProducts", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('search-by-name'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "searchByName", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_product_dto_1.CreateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, product_query_dto_1.ProductQueryDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, update_product_dto_1.UpdateProductDto]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "update", null);
__decorate([
    (0, common_1.Put)(':id/toggle-status'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('action')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "toggleStatus", null);
__decorate([
    (0, common_1.Put)(':id/tax'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)('taxId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ProductsController.prototype, "updateTax", null);
exports.ProductsController = ProductsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('products'),
    __metadata("design:paramtypes", [products_service_1.ProductsService])
], ProductsController);
//# sourceMappingURL=products.controller.js.map