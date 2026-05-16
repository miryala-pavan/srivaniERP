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
exports.GstReportsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const gst_reports_service_1 = require("./gst-reports.service");
const excel_export_service_1 = require("./excel-export.service");
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
let GstReportsController = class GstReportsController {
    gstReports;
    excelExport;
    constructor(gstReports, excelExport) {
        this.gstReports = gstReports;
        this.excelExport = excelExport;
    }
    getSalesRegister(req, month, year) {
        return this.gstReports.getSalesRegister(req.user.businessId, month, year);
    }
    async getSalesRegisterExcel(req, res, month, year) {
        const data = await this.gstReports.getSalesRegister(req.user.businessId, month, year);
        const buf = this.excelExport.generateSalesRegisterExcel(data);
        const filename = `Sales_Register_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buf);
    }
    getPurchaseRegister(req, month, year) {
        return this.gstReports.getPurchaseRegister(req.user.businessId, month, year);
    }
    async getPurchaseRegisterExcel(req, res, month, year) {
        const data = await this.gstReports.getPurchaseRegister(req.user.businessId, month, year);
        const buf = this.excelExport.generatePurchaseRegisterExcel(data);
        const filename = `Purchase_Register_${MONTH_ABBR[month - 1]}_${year}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buf);
    }
    getGSTR3B(req, month, year) {
        return this.gstReports.getGSTR3BSummary(req.user.businessId, month, year);
    }
    getHSNSummary(req, month, year) {
        return this.gstReports.getHSNSummary(req.user.businessId, month, year);
    }
    getGSTR1Json(req, month, year) {
        return this.gstReports.getGSTR1Json(req.user.businessId, month, year);
    }
};
exports.GstReportsController = GstReportsController;
__decorate([
    (0, common_1.Get)('sales-register'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], GstReportsController.prototype, "getSalesRegister", null);
__decorate([
    (0, common_1.Get)('sales-register/excel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], GstReportsController.prototype, "getSalesRegisterExcel", null);
__decorate([
    (0, common_1.Get)('purchase-register'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], GstReportsController.prototype, "getPurchaseRegister", null);
__decorate([
    (0, common_1.Get)('purchase-register/excel'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(3, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Number, Number]),
    __metadata("design:returntype", Promise)
], GstReportsController.prototype, "getPurchaseRegisterExcel", null);
__decorate([
    (0, common_1.Get)('gstr3b'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], GstReportsController.prototype, "getGSTR3B", null);
__decorate([
    (0, common_1.Get)('hsn-summary'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], GstReportsController.prototype, "getHSNSummary", null);
__decorate([
    (0, common_1.Get)('gstr1-json'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('month', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('year', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Number]),
    __metadata("design:returntype", void 0)
], GstReportsController.prototype, "getGSTR1Json", null);
exports.GstReportsController = GstReportsController = __decorate([
    (0, common_1.Controller)('reports/gst'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTS_PERSON'),
    __metadata("design:paramtypes", [gst_reports_service_1.GstReportsService,
        excel_export_service_1.ExcelExportService])
], GstReportsController);
//# sourceMappingURL=gst-reports.controller.js.map