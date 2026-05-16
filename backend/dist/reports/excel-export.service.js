"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelExportService = void 0;
const common_1 = require("@nestjs/common");
const XLSX = __importStar(require("xlsx"));
const fmt = (n) => Math.round(n * 100) / 100;
function fmtDate(iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
let ExcelExportService = class ExcelExportService {
    generateSalesRegisterExcel(data) {
        const wb = XLSX.utils.book_new();
        const b2bRows = [
            ['Sr No', 'Invoice Date', 'Invoice No', 'Customer Name', 'Customer GSTIN',
                'Taxable Amount', 'CGST', 'SGST', 'IGST', 'CESS', 'Invoice Value'],
            ...data.b2b.map((r, i) => [
                i + 1, fmtDate(r.billDate), r.billNumber, r.customerName, r.customerGstin,
                fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), fmt(r.grandTotal),
            ]),
            ['', '', '', '', 'TOTAL',
                fmt(data.b2b.reduce((s, r) => s + r.taxableAmount, 0)),
                fmt(data.b2b.reduce((s, r) => s + r.cgst, 0)),
                fmt(data.b2b.reduce((s, r) => s + r.sgst, 0)),
                fmt(data.b2b.reduce((s, r) => s + r.igst, 0)),
                fmt(data.b2b.reduce((s, r) => s + r.cess, 0)),
                fmt(data.b2b.reduce((s, r) => s + r.grandTotal, 0)),
            ],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2bRows), 'B2B Invoices');
        const b2cRows = [
            ['State Code', 'GST Rate %', 'Taxable Amount', 'CGST', 'SGST', 'IGST', 'CESS', 'No. of Invoices'],
            ...data.b2c.map((r) => [
                r.stateCode, r.gstRate,
                fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), r.count,
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(b2cRows), 'B2C Summary');
        const hsnRows = [
            ['HSN Code', 'Description', 'UOM', 'Total Qty', 'Taxable Value',
                'CGST', 'SGST', 'IGST', 'CESS', 'Total Tax'],
            ...data.hsnSummary.map((r) => [
                r.hsnCode, r.description, r.uom, r.totalQty,
                fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess), fmt(r.totalTax),
            ]),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hsnRows), 'HSN Summary');
        const summaryRows = [
            ['Period', data.period],
            ['Total Bills', data.totals.totalBills],
            ['Total Taxable', fmt(data.totals.totalTaxable)],
            ['Total CGST', fmt(data.totals.totalCgst)],
            ['Total SGST', fmt(data.totals.totalSgst)],
            ['Total IGST', fmt(data.totals.totalIgst)],
            ['Total Cess', fmt(data.totals.totalCess)],
            ['Grand Total', fmt(data.totals.totalGrandTotal)],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
    generatePurchaseRegisterExcel(data) {
        const wb = XLSX.utils.book_new();
        const purchaseRows = [
            ['GRN No', 'GRN Date', 'Supplier', 'Supplier GSTIN',
                'Invoice No', 'Invoice Date', 'Taxable', 'CGST', 'SGST', 'IGST', 'CESS', 'Total', 'ITC Eligible'],
            ...data.purchases.map((r) => [
                r.grnNumber, fmtDate(r.grnDate), r.supplierName, r.supplierGstin,
                r.invoiceNumber, fmtDate(r.invoiceDate),
                fmt(r.taxableAmount), fmt(r.cgst), fmt(r.sgst), fmt(r.igst), fmt(r.cess),
                fmt(r.totalAmount), r.itcEligibility,
            ]),
            ['TOTAL', '', '', '', '', '',
                fmt(data.purchases.reduce((s, r) => s + r.taxableAmount, 0)),
                fmt(data.purchases.reduce((s, r) => s + r.cgst, 0)),
                fmt(data.purchases.reduce((s, r) => s + r.sgst, 0)),
                fmt(data.purchases.reduce((s, r) => s + r.igst, 0)),
                fmt(data.purchases.reduce((s, r) => s + r.cess, 0)),
                fmt(data.purchases.reduce((s, r) => s + r.totalAmount, 0)),
                '',],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(purchaseRows), 'Purchase Register');
        const itcRows = [
            ['ITC Summary', ''],
            ['Total Purchases', data.summary.totalPurchases],
            ['Eligible ITC', fmt(data.summary.eligibleITC)],
            ['Ineligible ITC', fmt(data.summary.ineligibleITC)],
            ['CGST ITC', fmt(data.summary.cgstITC)],
            ['SGST ITC', fmt(data.summary.sgstITC)],
            ['IGST ITC', fmt(data.summary.igstITC)],
            ['CESS ITC', fmt(data.summary.cessITC)],
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itcRows), 'ITC Summary');
        return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    }
};
exports.ExcelExportService = ExcelExportService;
exports.ExcelExportService = ExcelExportService = __decorate([
    (0, common_1.Injectable)()
], ExcelExportService);
//# sourceMappingURL=excel-export.service.js.map