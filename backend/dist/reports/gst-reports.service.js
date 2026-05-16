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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GstReportsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const r2 = (n) => Math.round(n * 100) / 100;
const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];
let GstReportsService = class GstReportsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getPeriodDates(month, year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);
        const period = `${MONTH_NAMES[month - 1]} ${year}`;
        return { startDate, endDate, period };
    }
    async getSalesRegister(businessId, month, year) {
        const { startDate, endDate, period } = this.getPeriodDates(month, year);
        const bills = await this.prisma.salesBill.findMany({
            where: {
                businessId,
                billDate: { gte: startDate, lte: endDate },
                status: 'FINAL',
                isVoided: false,
                billType: { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
            },
            include: {
                items: {
                    select: {
                        hsnCode: true, productName: true, quantity: true,
                        taxableAmount: true, gstRatePercent: true,
                        cgstAmount: true, sgstAmount: true, igstAmount: true,
                        cessAmount: true, unitOfMeasure: true,
                    },
                },
            },
            orderBy: { billDate: 'asc' },
        });
        const b2b = bills
            .filter((b) => b.isB2B || !!b.customerGstin)
            .map((b) => ({
            billNumber: b.billNumber ?? '',
            billDate: b.billDate.toISOString(),
            customerName: b.customerName ?? 'Walk-in',
            customerGstin: b.customerGstin ?? '',
            supplyStateCode: b.supplyStateCode ?? '',
            billType: b.billType,
            taxableAmount: Number(b.taxableAmount),
            cgst: Number(b.cgstTotal),
            sgst: Number(b.sgstTotal),
            igst: Number(b.igstTotal),
            cess: Number(b.cessTotal),
            grandTotal: Number(b.grandTotal),
        }));
        const b2cBills = bills.filter((b) => !b.isB2B && !b.customerGstin);
        const b2cMap = new Map();
        for (const bill of b2cBills) {
            const stateCode = bill.supplyStateCode ?? '36';
            const rateMap = new Map();
            if (bill.isHistorical && bill.items.length === 0) {
                let gstRate = 0;
                try {
                    const n = JSON.parse(bill.notes ?? '{}');
                    gstRate = Number(n.gstRate ?? 0);
                }
                catch { }
                rateMap.set(gstRate, {
                    taxable: Number(bill.taxableAmount),
                    cgst: Number(bill.cgstTotal),
                    sgst: Number(bill.sgstTotal),
                    igst: Number(bill.igstTotal),
                    cess: Number(bill.cessTotal),
                });
            }
            else {
                for (const item of bill.items) {
                    const rate = Number(item.gstRatePercent);
                    const existing = rateMap.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
                    rateMap.set(rate, {
                        taxable: r2(existing.taxable + Number(item.taxableAmount)),
                        cgst: r2(existing.cgst + Number(item.cgstAmount)),
                        sgst: r2(existing.sgst + Number(item.sgstAmount)),
                        igst: r2(existing.igst + Number(item.igstAmount)),
                        cess: r2(existing.cess + Number(item.cessAmount)),
                    });
                }
            }
            for (const [rate, vals] of rateMap) {
                const key = `${stateCode}__${rate}`;
                const existing = b2cMap.get(key) ?? { stateCode, gstRate: rate, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, count: 0 };
                b2cMap.set(key, {
                    stateCode, gstRate: rate,
                    taxableAmount: r2(existing.taxableAmount + vals.taxable),
                    cgst: r2(existing.cgst + vals.cgst),
                    sgst: r2(existing.sgst + vals.sgst),
                    igst: r2(existing.igst + vals.igst),
                    cess: r2(existing.cess + vals.cess),
                    count: existing.count + 1,
                });
            }
        }
        const b2c = [...b2cMap.values()].sort((a, b) => a.gstRate - b.gstRate);
        const hsnMap = new Map();
        for (const bill of bills) {
            for (const item of bill.items) {
                const hsn = item.hsnCode ?? 'UNCLASSIFIED';
                const existing = hsnMap.get(hsn) ?? {
                    hsnCode: hsn, description: item.productName, uom: item.unitOfMeasure ?? 'PCS',
                    totalQty: 0, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0,
                };
                hsnMap.set(hsn, {
                    ...existing,
                    totalQty: r2(existing.totalQty + Number(item.quantity)),
                    taxableAmount: r2(existing.taxableAmount + Number(item.taxableAmount)),
                    cgst: r2(existing.cgst + Number(item.cgstAmount)),
                    sgst: r2(existing.sgst + Number(item.sgstAmount)),
                    igst: r2(existing.igst + Number(item.igstAmount)),
                    cess: r2(existing.cess + Number(item.cessAmount)),
                });
            }
        }
        const hsnSummary = [...hsnMap.values()].map((h) => ({
            ...h,
            totalTax: r2(h.cgst + h.sgst + h.igst + h.cess),
        }));
        const totals = {
            totalBills: bills.length,
            totalTaxable: r2(bills.reduce((s, b) => s + Number(b.taxableAmount), 0)),
            totalCgst: r2(bills.reduce((s, b) => s + Number(b.cgstTotal), 0)),
            totalSgst: r2(bills.reduce((s, b) => s + Number(b.sgstTotal), 0)),
            totalIgst: r2(bills.reduce((s, b) => s + Number(b.igstTotal), 0)),
            totalCess: r2(bills.reduce((s, b) => s + Number(b.cessTotal), 0)),
            totalGrandTotal: r2(bills.reduce((s, b) => s + Number(b.grandTotal), 0)),
        };
        return { period, b2b, b2c, hsnSummary, totals };
    }
    async getPurchaseRegister(businessId, month, year) {
        const { startDate, endDate, period } = this.getPeriodDates(month, year);
        const purchases = await this.prisma.purchase.findMany({
            where: {
                businessId,
                status: 'APPROVED',
                invoiceDate: { gte: startDate, lte: endDate },
            },
            orderBy: { invoiceDate: 'asc' },
        });
        const purchaseList = purchases.map((p) => {
            const eligible = p.itcEligibility !== 'NOT_ELIGIBLE';
            return {
                grnNumber: p.grnNumber ?? '',
                grnDate: (p.approvedAt ?? p.invoiceDate).toISOString(),
                supplierName: p.supplierName,
                supplierGstin: p.supplierGstin ?? '',
                invoiceNumber: p.invoiceNumber,
                invoiceDate: p.invoiceDate.toISOString(),
                isInterState: p.isInterState,
                itcEligibility: p.itcEligibility,
                taxableAmount: Number(p.taxableAmount),
                cgst: Number(p.cgstTotal),
                sgst: Number(p.sgstTotal),
                igst: Number(p.igstTotal),
                cess: Number(p.cessTotal),
                totalAmount: Number(p.grandTotal),
                itcClaimed: eligible ? Number(p.totalTaxAmount) : 0,
            };
        });
        const eligible = purchases.filter((p) => p.itcEligibility !== 'NOT_ELIGIBLE');
        const ineligible = purchases.filter((p) => p.itcEligibility === 'NOT_ELIGIBLE');
        const summary = {
            totalPurchases: purchases.length,
            eligibleITC: r2(eligible.reduce((s, p) => s + Number(p.totalTaxAmount), 0)),
            ineligibleITC: r2(ineligible.reduce((s, p) => s + Number(p.totalTaxAmount), 0)),
            cgstITC: r2(eligible.reduce((s, p) => s + Number(p.cgstTotal), 0)),
            sgstITC: r2(eligible.reduce((s, p) => s + Number(p.sgstTotal), 0)),
            igstITC: r2(eligible.reduce((s, p) => s + Number(p.igstTotal), 0)),
            cessITC: r2(eligible.reduce((s, p) => s + Number(p.cessTotal), 0)),
        };
        return { period, purchases: purchaseList, summary };
    }
    async getGSTR3BSummary(businessId, month, year) {
        const [sales, purchase] = await Promise.all([
            this.getSalesRegister(businessId, month, year),
            this.getPurchaseRegister(businessId, month, year),
        ]);
        const sum = (arr) => arr.reduce((acc, b) => ({
            taxable: r2(acc.taxable + b.taxable),
            cgst: r2(acc.cgst + b.cgst),
            sgst: r2(acc.sgst + b.sgst),
            igst: r2(acc.igst + b.igst),
            cess: r2(acc.cess + b.cess),
        }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 });
        const b2bOut = sum(sales.b2b.map((b) => ({ taxable: b.taxableAmount, cgst: b.cgst, sgst: b.sgst, igst: b.igst, cess: b.cess })));
        const b2cOut = sum(sales.b2c.map((b) => ({ taxable: b.taxableAmount, cgst: b.cgst, sgst: b.sgst, igst: b.igst, cess: b.cess })));
        const totalOut = {
            taxable: r2(b2bOut.taxable + b2cOut.taxable),
            cgst: r2(b2bOut.cgst + b2cOut.cgst),
            sgst: r2(b2bOut.sgst + b2cOut.sgst),
            igst: r2(b2bOut.igst + b2cOut.igst),
            cess: r2(b2bOut.cess + b2cOut.cess),
        };
        const itc = {
            cgst: purchase.summary.cgstITC,
            sgst: purchase.summary.sgstITC,
            igst: purchase.summary.igstITC,
            cess: purchase.summary.cessITC,
        };
        const netPayable = {
            cgst: r2(Math.max(0, totalOut.cgst - itc.cgst)),
            sgst: r2(Math.max(0, totalOut.sgst - itc.sgst)),
            igst: r2(Math.max(0, totalOut.igst - itc.igst)),
            cess: r2(Math.max(0, totalOut.cess - itc.cess)),
            total: 0,
        };
        netPayable.total = r2(netPayable.cgst + netPayable.sgst + netPayable.igst + netPayable.cess);
        const totalITC = r2(itc.cgst + itc.sgst + itc.igst + itc.cess);
        const totalOutTax = r2(totalOut.cgst + totalOut.sgst + totalOut.igst + totalOut.cess);
        const itcUsed = r2(Math.min(totalITC, totalOutTax));
        return {
            period: sales.period,
            outwardSupplies: { b2b: b2bOut, b2c: b2cOut, total: totalOut },
            itcAvailable: { fromPurchases: itc, eligible: itc },
            netPayable,
            inputServiceDistribution: 0,
            reverseCharge: { cgst: 0, sgst: 0, igst: 0 },
            creditLedger: {
                openingBalance: 0,
                itcClaimed: totalITC,
                taxPaid: itcUsed,
                closingBalance: r2(totalITC - itcUsed),
            },
        };
    }
    async getHSNSummary(businessId, month, year) {
        const { startDate, endDate, period } = this.getPeriodDates(month, year);
        const items = await this.prisma.salesItem.findMany({
            where: {
                bill: {
                    businessId,
                    billDate: { gte: startDate, lte: endDate },
                    status: 'FINAL',
                    isVoided: false,
                    billType: { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
                },
            },
        });
        const hsnMap = new Map();
        for (const item of items) {
            const hsn = item.hsnCode ?? 'UNCLASSIFIED';
            const existing = hsnMap.get(hsn) ?? { hsnCode: hsn, totalQuantity: 0, totalTaxableValue: 0, totalGST: 0, totalCess: 0 };
            hsnMap.set(hsn, {
                hsnCode: hsn,
                totalQuantity: r2(existing.totalQuantity + Number(item.quantity)),
                totalTaxableValue: r2(existing.totalTaxableValue + Number(item.taxableAmount)),
                totalGST: r2(existing.totalGST + Number(item.cgstAmount) + Number(item.sgstAmount) + Number(item.igstAmount)),
                totalCess: r2(existing.totalCess + Number(item.cessAmount)),
            });
        }
        return { period, hsnData: [...hsnMap.values()].sort((a, b) => a.hsnCode.localeCompare(b.hsnCode)) };
    }
    async getGSTR1Json(businessId, month, year) {
        const [salesData, biz] = await Promise.all([
            this.getSalesRegister(businessId, month, year),
            this.prisma.business.findUnique({ where: { id: businessId }, select: { gstin: true } }),
        ]);
        const fp = `${String(month).padStart(2, '0')}${year}`;
        const b2bByGstin = new Map();
        for (const bill of salesData.b2b) {
            if (!bill.customerGstin)
                continue;
            const list = b2bByGstin.get(bill.customerGstin) ?? [];
            list.push(bill);
            b2bByGstin.set(bill.customerGstin, list);
        }
        const b2b = [...b2bByGstin.entries()].map(([ctin, invList]) => ({
            ctin,
            inv: invList.map((bill) => {
                const d = new Date(bill.billDate);
                const idt = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                return {
                    inum: bill.billNumber,
                    idt,
                    val: bill.grandTotal,
                    pos: bill.supplyStateCode || '36',
                    rchrg: 'N',
                    itms: [{
                            num: 1,
                            itm_det: {
                                txval: bill.taxableAmount,
                                rt: 0,
                                camt: bill.cgst,
                                samt: bill.sgst,
                                csamt: bill.cess,
                            },
                        }],
                };
            }),
        }));
        const b2cs = salesData.b2c.map((b) => ({
            pos: b.stateCode,
            rt: b.gstRate,
            typ: 'OE',
            txval: b.taxableAmount,
            camt: b.cgst,
            samt: b.sgst,
            csamt: b.cess,
        }));
        const hsn = {
            data: salesData.hsnSummary.map((h) => ({
                hsn_sc: h.hsnCode,
                uqc: h.uom,
                qty: h.totalQty,
                val: r2(h.taxableAmount + h.cgst + h.sgst + h.igst + h.cess),
                txval: h.taxableAmount,
                camt: h.cgst,
                samt: h.sgst,
                csamt: h.cess,
            })),
        };
        return { gstin: biz?.gstin ?? '', fp, b2b, b2cs, hsn };
    }
};
exports.GstReportsService = GstReportsService;
exports.GstReportsService = GstReportsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GstReportsService);
//# sourceMappingURL=gst-reports.service.js.map