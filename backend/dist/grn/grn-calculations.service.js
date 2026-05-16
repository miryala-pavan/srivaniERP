"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrnCalculationsService = void 0;
const common_1 = require("@nestjs/common");
let GrnCalculationsService = class GrnCalculationsService {
    r2(n) { return Math.round(n * 100) / 100; }
    calculateItemTotals(item, gstRate, taxType, isInterState) {
        const d = (v) => v ?? 0;
        const r2 = this.r2.bind(this);
        const netCostPrice = r2(item.basicCostPrice
            * (1 - d(item.disc1Percent) / 100)
            * (1 - d(item.disc2Percent) / 100)
            * (1 - d(item.disc3Percent) / 100)
            * (1 - d(item.disc4Percent) / 100));
        const packSize = item.packSize ?? 1;
        const totalReceivedQty = r2((d(item.casesReceived) * packSize) + d(item.looseQty));
        const totalFreeQty = r2((d(item.freeCases) * packSize) + d(item.freeLoose));
        const totalQty = r2(totalReceivedQty + totalFreeQty);
        let taxable;
        if (taxType === 'TAX_INCLUSIVE') {
            taxable = r2((netCostPrice / (1 + gstRate / 100)) * totalReceivedQty);
        }
        else {
            taxable = r2(netCostPrice * totalReceivedQty);
        }
        const cashDiscAmount = r2(taxable * d(item.cashDiscPercent) / 100);
        const taxableNet = r2(taxable - cashDiscAmount);
        const cessRate = d(item.cessRate);
        const cessAmount = r2(taxableNet * cessRate / 100);
        let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
        if (isInterState) {
            igstAmount = r2(taxableNet * gstRate / 100);
        }
        else {
            cgstAmount = r2(taxableNet * gstRate / 2 / 100);
            sgstAmount = r2(taxableNet * gstRate / 2 / 100);
        }
        const lineTotal = r2(taxableNet + cgstAmount + sgstAmount + igstAmount + cessAmount);
        return {
            netCostPrice,
            totalReceivedQty,
            totalFreeQty,
            totalQty,
            taxable: taxableNet,
            cashDiscAmount,
            cgstAmount,
            sgstAmount,
            igstAmount,
            cessAmount,
            lineTotal,
        };
    }
    spreadAdjustments(calcs, freightCharges, hamaliCharges) {
        const r2 = this.r2.bind(this);
        const totalLineTotal = calcs.reduce((s, c) => s + c.lineTotal, 0) || 1;
        return calcs.map((c) => {
            const weight = c.lineTotal / totalLineTotal;
            const freightShare = r2(freightCharges * weight);
            const hamaliShare = r2(hamaliCharges * weight);
            const divisor = c.totalQty || 1;
            const trueCostPrice = r2((c.lineTotal + freightShare + hamaliShare) / divisor);
            return { ...c, freightShare, hamaliShare, trueCostPrice };
        });
    }
    calculateBillTotals(items, billDiscountPercent, freightCharges, hamaliCharges, otherCharges, roundingAmount) {
        const r2 = this.r2.bind(this);
        const taxableTotal = r2(items.reduce((s, i) => s + i.taxable, 0));
        const cgstTotal = r2(items.reduce((s, i) => s + i.cgstAmount, 0));
        const sgstTotal = r2(items.reduce((s, i) => s + i.sgstAmount, 0));
        const igstTotal = r2(items.reduce((s, i) => s + i.igstAmount, 0));
        const cessTotal = r2(items.reduce((s, i) => s + i.cessAmount, 0));
        const totalTaxAmount = r2(cgstTotal + sgstTotal + igstTotal);
        const itemsTotal = r2(items.reduce((s, i) => s + i.lineTotal, 0));
        const billDiscountAmount = r2(taxableTotal * billDiscountPercent / 100);
        const grandTotal = r2(itemsTotal
            - billDiscountAmount
            + freightCharges
            + hamaliCharges
            + otherCharges
            + roundingAmount);
        return { taxableTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, totalTaxAmount, billDiscountAmount, grandTotal };
    }
    validateInvoiceControlTotal(calculated, controlTotal) {
        const diff = Math.abs(calculated - controlTotal);
        if (diff > 50) {
            throw new common_1.BadRequestException(`Invoice total mismatch: calculated Rs.${calculated}, invoice shows Rs.${controlTotal} (diff Rs.${diff.toFixed(2)})`);
        }
    }
    calculateMinimumSellingPrice(netCostPrice, gstRate, marginPct) {
        const costWithTax = netCostPrice * (1 + gstRate / 100);
        return this.r2(costWithTax * (1 + marginPct / 100));
    }
};
exports.GrnCalculationsService = GrnCalculationsService;
exports.GrnCalculationsService = GrnCalculationsService = __decorate([
    (0, common_1.Injectable)()
], GrnCalculationsService);
//# sourceMappingURL=grn-calculations.service.js.map