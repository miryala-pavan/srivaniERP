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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const argon2 = __importStar(require("argon2"));
function tcField(s) {
    if (!s)
        return s ?? undefined;
    return s.trim().split(' ').map((w) => {
        if (!w)
            return w;
        if (/\d/.test(w))
            return w;
        if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+$/.test(w))
            return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
}
let AdminService = class AdminService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async seed(businessId) {
        const business = await this.prisma.business.findUnique({ where: { id: businessId } });
        if (!business)
            return { message: 'Business not found', seeded: false };
        const results = [];
        let branch = await this.prisma.branch.findFirst({
            where: { businessId, name: 'Main Branch' },
        });
        if (!branch) {
            branch = await this.prisma.branch.create({
                data: { businessId, name: 'Main Branch', address: 'Main Store Location', phone: business.phone },
            });
            results.push('branch: Main Branch created');
        }
        else {
            results.push('branch: Main Branch already exists');
        }
        const now = new Date();
        const fyYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const fyCode = `${fyYear}-${String(fyYear + 1).slice(-2)}`;
        let fy = await this.prisma.financialYear.findFirst({
            where: { businessId, fyCode },
        });
        if (!fy) {
            fy = await this.prisma.financialYear.create({
                data: {
                    businessId,
                    fyCode,
                    startDate: new Date(fyYear, 3, 1),
                    endDate: new Date(fyYear + 1, 2, 31),
                    isActive: true,
                },
            });
            results.push(`financialYear: ${fyCode} created`);
        }
        else {
            results.push(`financialYear: ${fyCode} already exists`);
        }
        const seriesDefs = [
            { billType: 'TAX_INVOICE', seriesPrefix: 'GST/', numberFormat: '0000', label: 'GST/ Tax Invoice' },
            { billType: 'RETAIL_INVOICE', seriesPrefix: 'INV/', numberFormat: '0000', label: 'INV/ Retail Invoice' },
            { billType: 'ESTIMATE', seriesPrefix: 'EST/', numberFormat: '0000', label: 'EST/ Estimate' },
            { billType: 'GRN', seriesPrefix: 'GRN/', numberFormat: '00000', label: 'GRN/ Goods Receipt Note' },
            { billType: 'SCN', seriesPrefix: 'SCN/', numberFormat: '0000', label: 'SCN/ Supplier Credit Note' },
        ];
        const seriesCreated = [];
        for (const s of seriesDefs) {
            const existing = await this.prisma.billSeries.findFirst({
                where: { businessId, financialYearId: fy.id, billType: s.billType },
            });
            if (!existing) {
                await this.prisma.billSeries.create({
                    data: {
                        businessId,
                        financialYearId: fy.id,
                        billType: s.billType,
                        seriesPrefix: s.seriesPrefix,
                        currentNumber: 0,
                        numberFormat: s.numberFormat,
                    },
                });
                seriesCreated.push(s.label);
            }
        }
        results.push(seriesCreated.length
            ? `billSeries: created ${seriesCreated.join(', ')}`
            : 'billSeries: all 5 series already exist');
        const taxDefs = [
            { taxName: 'GST 0%', taxCode: 'GST0', taxRate: 0 },
            { taxName: 'GST 5%', taxCode: 'GST5', taxRate: 5 },
            { taxName: 'GST 12%', taxCode: 'GST12', taxRate: 12 },
            { taxName: 'GST 18%', taxCode: 'GST18', taxRate: 18 },
            { taxName: 'GST 28%', taxCode: 'GST28', taxRate: 28 },
            { taxName: 'GST 0.25%', taxCode: 'GST025', taxRate: 0.25 },
        ];
        let taxesCreated = 0;
        const taxMap = {};
        for (const t of taxDefs) {
            const tax = await this.prisma.tax.upsert({
                where: { businessId_taxCode: { businessId, taxCode: t.taxCode } },
                update: {},
                create: { businessId, ...t, isActive: true },
            });
            taxMap[t.taxCode] = tax.id;
            taxesCreated++;
        }
        results.push(`taxes: ${taxesCreated} upserted`);
        const catDefs = [
            { code: 'OL', label: 'OIL', name: 'Oils & Ghee' },
            { code: 'GR', label: 'GROCERY', name: 'Grocery & Staples' },
            { code: 'DL', label: 'DAL', name: 'Dal & Pulses' },
            { code: 'MS', label: 'MASALA', name: 'Masala & Spices' },
            { code: 'DP', label: 'DAIRY', name: 'Dairy & Poultry' },
            { code: 'BV', label: 'BEVERAGES', name: 'Beverages' },
            { code: 'SN', label: 'SNACKS', name: 'Snacks & Namkeen' },
            { code: 'CL', label: 'CLEANING', name: 'Cleaning & Household' },
            { code: 'PC', label: 'PERSONAL CARE', name: 'Personal Care' },
            { code: 'FR', label: 'FRESH', name: 'Fresh & Vegetables' },
            { code: 'SV', label: 'SRIVANI BRAND', name: 'Srivani Brand' },
            { code: 'RM', label: 'RAW MATERIAL', name: 'Raw Materials' },
            { code: 'PK', label: 'PACKAGING', name: 'Packaging Materials' },
        ];
        const catMap = {};
        let catsCreated = 0;
        for (const c of catDefs) {
            const cat = await this.prisma.category.upsert({
                where: { businessId_code: { businessId, code: c.code } },
                update: { label: c.label, name: c.name },
                create: { businessId, code: c.code, label: c.label, name: c.name },
            });
            catMap[c.code] = cat.id;
            catsCreated++;
        }
        const subCatDefs = [
            { code: 'OL-SN', label: 'SUNFLOWER', name: 'Sunflower Oil', parent: 'OL' },
            { code: 'OL-GN', label: 'GROUNDNUT', name: 'Groundnut Oil', parent: 'OL' },
            { code: 'OL-GH', label: 'GHEE', name: 'Ghee', parent: 'OL' },
            { code: 'OL-CO', label: 'COCONUT', name: 'Coconut Oil', parent: 'OL' },
            { code: 'OL-OL', label: 'OLIVE', name: 'Olive Oil', parent: 'OL' },
            { code: 'GR-RC', label: 'RICE', name: 'Rice & Rice Products', parent: 'GR' },
            { code: 'GR-WT', label: 'ATTA', name: 'Wheat & Atta', parent: 'GR' },
            { code: 'GR-SG', label: 'SUGAR', name: 'Sugar & Jaggery', parent: 'GR' },
            { code: 'GR-SL', label: 'SALT', name: 'Salt & Seasoning', parent: 'GR' },
            { code: 'GR-BD', label: 'BESAN', name: 'Besan & Flour', parent: 'GR' },
            { code: 'DL-TR', label: 'TOOR DAL', name: 'Toor Dal', parent: 'DL' },
            { code: 'DL-CH', label: 'CHANA DAL', name: 'Chana Dal', parent: 'DL' },
            { code: 'DL-MG', label: 'MOONG DAL', name: 'Moong Dal', parent: 'DL' },
            { code: 'DL-UR', label: 'URAD DAL', name: 'Urad Dal', parent: 'DL' },
            { code: 'DL-MX', label: 'MIXED DAL', name: 'Mixed Dal', parent: 'DL' },
            { code: 'MS-RD', label: 'RED CHILLI', name: 'Red Chilli', parent: 'MS' },
            { code: 'MS-TR', label: 'TURMERIC', name: 'Turmeric', parent: 'MS' },
            { code: 'MS-CR', label: 'CORIANDER', name: 'Coriander', parent: 'MS' },
            { code: 'MS-MB', label: 'MIXED', name: 'Mixed & Blended Masala', parent: 'MS' },
            { code: 'MS-CU', label: 'CUMIN', name: 'Cumin & Jeera', parent: 'MS' },
            { code: 'DP-ML', label: 'MILK', name: 'Milk', parent: 'DP' },
            { code: 'DP-CR', label: 'CURD', name: 'Curd & Paneer', parent: 'DP' },
            { code: 'DP-BT', label: 'BUTTER', name: 'Butter & Cheese', parent: 'DP' },
            { code: 'DP-EG', label: 'EGGS', name: 'Eggs', parent: 'DP' },
            { code: 'DP-IC', label: 'ICE CREAM', name: 'Ice Cream', parent: 'DP' },
            { code: 'BV-TF', label: 'TEA/COFFEE', name: 'Tea & Coffee', parent: 'BV' },
            { code: 'BV-CL', label: 'COLD DRINK', name: 'Cold Drinks', parent: 'BV' },
            { code: 'BV-JC', label: 'JUICE', name: 'Juice & Drinks', parent: 'BV' },
            { code: 'BV-WR', label: 'WATER', name: 'Water', parent: 'BV' },
            { code: 'BV-EN', label: 'ENERGY', name: 'Energy Drinks', parent: 'BV' },
            { code: 'SN-CH', label: 'CHIPS', name: 'Chips & Crisps', parent: 'SN' },
            { code: 'SN-BK', label: 'BISCUITS', name: 'Biscuits & Cookies', parent: 'SN' },
            { code: 'SN-NM', label: 'NAMKEEN', name: 'Namkeen & Mixture', parent: 'SN' },
            { code: 'SN-CC', label: 'CHOCOLATE', name: 'Chocolates & Sweets', parent: 'SN' },
            { code: 'SN-DF', label: 'DRY FRUITS', name: 'Dry Fruits & Nuts', parent: 'SN' },
            { code: 'CL-DT', label: 'DETERGENT', name: 'Detergent & Washing', parent: 'CL' },
            { code: 'CL-DS', label: 'DISHWASH', name: 'Dishwash', parent: 'CL' },
            { code: 'CL-FH', label: 'FLOOR', name: 'Floor & Home Cleaner', parent: 'CL' },
            { code: 'CL-FR', label: 'FRESHENER', name: 'Air Freshener', parent: 'CL' },
            { code: 'PC-SP', label: 'SOAP', name: 'Soap & Bodywash', parent: 'PC' },
            { code: 'PC-SH', label: 'SHAMPOO', name: 'Shampoo & Hair', parent: 'PC' },
            { code: 'PC-TP', label: 'TOOTHPASTE', name: 'Toothpaste & Brush', parent: 'PC' },
            { code: 'PC-SK', label: 'SKINCARE', name: 'Skincare & Face', parent: 'PC' },
            { code: 'PC-DO', label: 'DEODORANT', name: 'Deodorant & Perfume', parent: 'PC' },
            { code: 'FR-VG', label: 'VEGETABLES', name: 'Vegetables', parent: 'FR' },
            { code: 'FR-FR', label: 'FRUITS', name: 'Fruits', parent: 'FR' },
            { code: 'FR-HB', label: 'HERBS', name: 'Herbs & Greens', parent: 'FR' },
            { code: 'SV-SG', label: 'SVN SUGAR', name: 'Srivani Sugar', parent: 'SV' },
            { code: 'SV-DL', label: 'SVN DAL', name: 'Srivani Dal', parent: 'SV' },
            { code: 'SV-DF', label: 'SVN DRY FRUITS', name: 'Srivani Dry Fruits', parent: 'SV' },
            { code: 'SV-MS', label: 'SVN MASALA', name: 'Srivani Masala', parent: 'SV' },
            { code: 'SV-RC', label: 'SVN RICE', name: 'Srivani Rice', parent: 'SV' },
            { code: 'RM-SG', label: 'RAW SUGAR', name: 'Sugar Raw Bulk', parent: 'RM' },
            { code: 'RM-CS', label: 'RAW CASHEW', name: 'Cashew Raw Bulk', parent: 'RM' },
            { code: 'RM-DL', label: 'RAW DAL', name: 'Dal Raw Bulk', parent: 'RM' },
            { code: 'RM-RC', label: 'RAW RICE', name: 'Rice Raw Bulk', parent: 'RM' },
            { code: 'RM-SP', label: 'RAW SPICE', name: 'Spice Raw Bulk', parent: 'RM' },
            { code: 'PK-PH', label: 'POUCHES', name: 'Plastic Pouches', parent: 'PK' },
            { code: 'PK-LB', label: 'LABELS', name: 'Labels & Stickers', parent: 'PK' },
            { code: 'PK-BX', label: 'BOXES', name: 'Boxes & Cartons', parent: 'PK' },
            { code: 'PK-TW', label: 'TWINE', name: 'Twine & Tape', parent: 'PK' },
        ];
        let subCatsCreated = 0;
        for (const s of subCatDefs) {
            const parentId = catMap[s.parent];
            if (!parentId)
                continue;
            await this.prisma.category.upsert({
                where: { businessId_code: { businessId, code: s.code } },
                update: { label: s.label, name: s.name, parentId },
                create: { businessId, code: s.code, label: s.label, name: s.name, parentId },
            });
            subCatsCreated++;
        }
        results.push(`categories: ${catsCreated} main + ${subCatsCreated} sub-categories upserted`);
        const supplierDefs = [
            {
                name: 'Sri Balaji Traders', gstin: '36AABCS1429B1ZB',
                phone: '9000000001', stateCode: '36',
                address: 'Secunderabad, Telangana',
            },
            {
                name: 'Hindustan Unilever Dist', gstin: '36AAACH8564E1Z5',
                phone: '9000000002', stateCode: '36',
                address: 'Hyderabad, Telangana',
            },
            {
                name: 'ITC Foods Distributor', gstin: '36AABCI1234F1Z3',
                phone: '9000000003', stateCode: '36',
                address: 'Kukatpally, Hyderabad',
            },
        ];
        let suppliersCreated = 0;
        for (const s of supplierDefs) {
            const existing = await this.prisma.supplier.findFirst({
                where: { businessId, name: s.name },
            });
            if (!existing) {
                await this.prisma.supplier.create({ data: { businessId, ...s } });
                suppliersCreated++;
            }
        }
        results.push(`suppliers: ${suppliersCreated} created (${supplierDefs.length - suppliersCreated} already existed)`);
        const brandDefs = [
            'HUL', 'ITC', 'Amul', 'Nestle', 'Britannia',
            'Parle', 'Dabur', 'Marico', 'Godrej', 'Srivani',
        ];
        let brandsCreated = 0;
        for (const name of brandDefs) {
            await this.prisma.brand.upsert({
                where: { businessId_name: { businessId, name } },
                update: {},
                create: { businessId, name, isActive: true },
            });
            brandsCreated++;
        }
        results.push(`brands: ${brandsCreated} upserted`);
        const allCats = await this.prisma.category.findMany({ where: { businessId } });
        const allCatMap = {};
        for (const c of allCats)
            allCatMap[c.code] = c.id;
        const productDefs = [
            {
                name: 'Sunflower Oil 1L', barcode: '8901234567890',
                hsnCode: '1512', taxCode: 'GST5', categoryCode: 'OL-SN',
                mrp: 180, sellingPrice: 165, costPrice: 145, reorderLevel: 10,
            },
            {
                name: 'Tata Salt 1kg', barcode: '8902010101010',
                hsnCode: '2501', taxCode: 'GST0', categoryCode: 'GR-SL',
                mrp: 24, sellingPrice: 22, costPrice: 18, reorderLevel: 20,
            },
            {
                name: 'Amul Full Cream Milk 500ml', barcode: '8901853001001',
                hsnCode: '0401', taxCode: 'GST0', categoryCode: 'DP-ML',
                mrp: 28, sellingPrice: 28, costPrice: 24, reorderLevel: 30,
            },
            {
                name: 'Lays Classic Salted 26g', barcode: '8901491000002',
                hsnCode: '1905', taxCode: 'GST12', categoryCode: 'SN-CH',
                mrp: 20, sellingPrice: 20, costPrice: 15, reorderLevel: 25,
            },
            {
                name: 'Colgate MaxFresh 150g', barcode: '8901314006047',
                hsnCode: '3306', taxCode: 'GST18', categoryCode: 'PC-TP',
                mrp: 115, sellingPrice: 105, costPrice: 90, reorderLevel: 10,
            },
        ];
        let productsCreated = 0;
        for (const p of productDefs) {
            const existing = await this.prisma.product.findFirst({
                where: { businessId, barcode: p.barcode },
            });
            if (!existing) {
                const taxId = taxMap[p.taxCode];
                const categoryId = allCatMap[p.categoryCode];
                const tax = await this.prisma.tax.findUnique({ where: { id: taxId } });
                const lastProduct = await this.prisma.product.findFirst({
                    where: { businessId, productCode: { not: null } },
                    orderBy: { productCode: 'desc' },
                });
                const nextCode = lastProduct?.productCode
                    ? String(parseInt(lastProduct.productCode, 10) + 1).padStart(6, '0')
                    : '000001';
                const product = await this.prisma.product.create({
                    data: {
                        businessId, taxId, categoryId,
                        productCode: nextCode,
                        name: p.name,
                        barcode: p.barcode,
                        hsnCode: p.hsnCode,
                        unitOfMeasure: 'PCS',
                        mrp: p.mrp,
                        sellingPrice: p.sellingPrice,
                        costPrice: p.costPrice,
                        gstRatePercent: tax ? Number(tax.taxRate) : 0,
                        reorderLevel: p.reorderLevel,
                        allowNegativeStock: false,
                    },
                });
                await this.prisma.stockLedger.create({
                    data: {
                        businessId,
                        branchId: branch.id,
                        productId: product.id,
                        movementType: 'ADJUSTMENT_IN',
                        quantity: 50,
                        referenceType: 'OPENING_STOCK',
                        notes: 'Seed opening stock',
                    },
                });
                productsCreated++;
            }
        }
        results.push(`products: ${productsCreated} created (${productDefs.length - productsCreated} already existed)`);
        const counterDefs = [
            { name: 'Counter 1', code: 'C1' },
            { name: 'Counter 2', code: 'C2' },
            { name: 'Counter 3', code: 'C3' },
            { name: 'Counter 4', code: 'C4' },
            { name: 'Counter 5', code: 'C5' },
        ];
        let countersCreated = 0;
        const counterMap = {};
        for (const c of counterDefs) {
            const counter = await this.prisma.posCounter.upsert({
                where: { businessId_code: { businessId, code: c.code } },
                update: {},
                create: { businessId, branchId: branch.id, name: c.name, code: c.code, status: 'ACTIVE' },
            });
            counterMap[c.code] = counter.id;
            countersCreated++;
        }
        results.push(`posCounters: ${countersCreated} counters upserted (C1-C5)`);
        const demoUserDefs = [
            { username: 'manager1', fullName: 'Manager One', pin: '111111', role: 'BRANCH_MANAGER', counterId: null },
            { username: 'manager2', fullName: 'Manager Two', pin: '222222', role: 'BRANCH_MANAGER', counterId: null },
            { username: 'cashier1', fullName: 'Cashier One', pin: '111111', role: 'CASHIER', counterId: counterMap['C1'] },
            { username: 'cashier2', fullName: 'Cashier Two', pin: '222222', role: 'CASHIER', counterId: counterMap['C2'] },
            { username: 'cashier3', fullName: 'Cashier Three', pin: '333333', role: 'CASHIER', counterId: counterMap['C3'] },
            { username: 'cashier4', fullName: 'Cashier Four', pin: '444444', role: 'CASHIER', counterId: counterMap['C4'] },
            { username: 'cashier5', fullName: 'Cashier Five', pin: '555555', role: 'CASHIER', counterId: counterMap['C5'] },
            { username: 'checker1', fullName: 'Purchase Checker One', pin: '111111', role: 'PURCHASE_CHECKER', counterId: null },
            { username: 'checker2', fullName: 'Purchase Checker Two', pin: '222222', role: 'PURCHASE_CHECKER', counterId: null },
            { username: 'viewer1', fullName: 'Viewer One', pin: '111111', role: 'VIEWER', counterId: null },
        ];
        let usersCreated = 0;
        for (const u of demoUserDefs) {
            const existing = await this.prisma.user.findFirst({ where: { businessId, username: u.username } });
            if (!existing) {
                const pinHash = await argon2.hash(u.pin, { type: argon2.argon2id });
                const unusableHash = await argon2.hash(`DISABLED_${u.username}_${Date.now()}`, { type: argon2.argon2id });
                await this.prisma.user.create({
                    data: {
                        businessId,
                        username: u.username,
                        fullName: u.fullName,
                        pin: pinHash,
                        passwordHash: unusableHash,
                        role: u.role,
                        status: 'ACTIVE',
                        counterId: u.counterId ?? undefined,
                        createdByName: 'System Seed',
                    },
                });
                usersCreated++;
            }
        }
        results.push(`demoUsers: ${usersCreated} created (${demoUserDefs.length - usersCreated} already existed)`);
        const nullCodeProducts = await this.prisma.product.findMany({
            where: { businessId, OR: [{ productCode: null }, { productCode: '' }] },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        if (nullCodeProducts.length > 0) {
            const lastCoded = await this.prisma.product.findFirst({
                where: { businessId, productCode: { not: null } },
                orderBy: { productCode: 'desc' },
                select: { productCode: true },
            });
            let counter = lastCoded?.productCode ? parseInt(lastCoded.productCode, 10) : 0;
            for (const p of nullCodeProducts) {
                counter++;
                await this.prisma.product.update({
                    where: { id: p.id },
                    data: { productCode: String(counter).padStart(6, '0') },
                });
            }
            results.push(`productCode repair: ${nullCodeProducts.length} products assigned codes`);
        }
        return { message: 'Seed completed', businessId, results };
    }
    async fixProductData(businessId) {
        const products = await this.prisma.product.findMany({
            where: { businessId },
            select: { id: true, name: true, shortName: true },
        });
        let updated = 0;
        for (const p of products) {
            const newName = tcField(p.name);
            const newShortName = tcField(p.shortName);
            const nameChanged = newName && newName !== p.name;
            const shortChanged = newShortName !== p.shortName;
            if (nameChanged || shortChanged) {
                await this.prisma.product.update({
                    where: { id: p.id },
                    data: {
                        ...(nameChanged ? { name: newName } : {}),
                        ...(shortChanged ? { shortName: newShortName } : {}),
                    },
                });
                updated++;
            }
        }
        return { message: 'Product data fixed', businessId, total: products.length, updated };
    }
    async resetBillSeries(businessId, dto) {
        const fy = await this.prisma.financialYear.findFirst({
            where: { businessId, isActive: true },
        });
        if (!fy)
            throw new common_1.BadRequestException('No active financial year found');
        const typeMap = {
            TAX_INVOICE: dto.taxInvoiceStart,
            RETAIL_INVOICE: dto.retailInvoiceStart,
            ESTIMATE: dto.estimateStart,
        };
        const results = [];
        for (const [billType, start] of Object.entries(typeMap)) {
            if (start === undefined || start === null)
                continue;
            if (!Number.isInteger(start) || start < 1) {
                throw new common_1.BadRequestException(`Starting number for ${billType} must be a positive integer`);
            }
            const series = await this.prisma.billSeries.findFirst({
                where: { businessId, financialYearId: fy.id, billType },
            });
            if (!series) {
                results.push(`${billType}: series not found (run seed first)`);
                continue;
            }
            if (start - 1 < series.currentNumber) {
                throw new common_1.BadRequestException(`Cannot set ${billType} starting number to ${start} — ${series.currentNumber} bills already issued this year. Choose a number greater than ${series.currentNumber}.`);
            }
            await this.prisma.billSeries.update({
                where: { id: series.id },
                data: { currentNumber: start - 1 },
            });
            results.push(`${billType}: next bill will be #${start}`);
        }
        return { message: 'Bill series updated', results };
    }
    async getTaxes(businessId) {
        return this.prisma.tax.findMany({
            where: { businessId, isActive: true },
            select: { id: true, taxName: true, taxCode: true, taxRate: true },
            orderBy: { taxRate: 'asc' },
        });
    }
    async seedDepartments(businessId) {
        const DEPT_SEED = [
            { name: 'Food & Grocery', code: 'FOOD', order: 1, categories: [
                    'Staples & Grains', 'Pulses & Lentils', 'Oils & Ghee', 'Spices & Masalas',
                    'Condiments & Sauces', 'Sugar & Sweeteners', 'Dairy & Eggs', 'Beverages - Hot',
                    'Beverages - Cold', 'Snacks & Namkeen', 'Biscuits & Cookies',
                    'Packaged & Instant Foods', 'Breakfast & Cereals', 'Bakery & Breads',
                    'Sweets & Mithai', 'Confectionery & Chocolates', 'Frozen Foods',
                    'Dry Fruits & Nuts', 'Dairy Alternatives', 'Organic & Natural Foods',
                    'Canned & Preserved Foods', 'Cooking Essentials',
                ] },
            { name: 'Fruits & Vegetables', code: 'FRVEG', order: 2, categories: [
                    'Fresh Fruits', 'Fresh Vegetables', 'Exotic & Imported', 'Herbs & Greens',
                    'Dry Vegetables', 'Sprouts & Seeds', 'Cut & Ready to Cook',
                ] },
            { name: 'Meat Fish & Eggs', code: 'MEAT', order: 3, categories: [
                    'Chicken & Mutton', 'Fish & Seafood', 'Eggs', 'Frozen Meat', 'Ready to Cook Meat',
                ] },
            { name: 'Home Care', code: 'HOMECARE', order: 4, categories: [
                    'Detergents & Laundry', 'Dishwash', 'Floor & Surface Cleaners', 'Toilet Care',
                    'Fresheners & Repellents', 'Mosquito Control', 'Garbage & Storage',
                    'Kitchen Accessories', 'Disposables', 'Pooja & Religious Items',
                ] },
            { name: 'Personal Care', code: 'PERSONAL', order: 5, categories: [
                    'Bath & Body', 'Hair Care', 'Skin Care', 'Oral Care', 'Deodorant & Perfume',
                    'Shaving & Grooming', 'Feminine Hygiene', 'Cosmetics & Makeup',
                    'Mens Grooming', 'Foot Care', 'Eye Care',
                ] },
            { name: 'Baby Care', code: 'BABY', order: 6, categories: [
                    'Baby Food & Milk', 'Diapers & Wipes', 'Baby Bath & Skin', 'Baby Health',
                    'Baby Accessories', 'Baby Clothing', 'Baby Toys',
                ] },
            { name: 'Health & Wellness', code: 'HEALTH', order: 7, categories: [
                    'Health Drinks & Supplements', 'Protein & Fitness', 'OTC Medicines',
                    'Ayurvedic & Herbal', 'Homeopathic', 'Diabetic & Diet Foods', 'First Aid',
                    'Surgical & Medical Accessories', 'Senior Care', 'Womens Health',
                ] },
            { name: 'Pet Care', code: 'PETCARE', order: 8, categories: [
                    'Dog Care', 'Cat Care', 'Bird Care', 'Fish & Aquarium',
                    'Small Animals', 'Pet Accessories', 'Pet Health',
                ] },
            { name: 'Stationery & Office', code: 'STATIONERY', order: 9, categories: [
                    'Stationery', 'Office Supplies', 'Art & Craft', 'School Supplies',
                    'Books & Magazines', 'Newspapers',
                ] },
            { name: 'Electrical & Hardware', code: 'ELECTRICAL', order: 10, categories: [
                    'Batteries & Torches', 'Bulbs & Lighting', 'Extension & Cables',
                    'Small Hardware', 'Tape & Adhesives', 'Tools',
                ] },
            { name: 'Tobacco & Related', code: 'TOBACCO', order: 11, categories: [
                    'Cigarettes', 'Bidi', 'Cigars', 'Chewing Tobacco',
                    'Pan & Gutka', 'Pan Masala', 'Hookah & Accessories',
                ] },
            { name: 'Liquor & Beverages', code: 'LIQUOR', order: 12, categories: [
                    'Beer', 'Wine', 'Whisky & Scotch', 'Rum', 'Vodka & Gin',
                    'Brandy', 'Country Liquor', 'Non-Alcoholic Mocktails',
                ] },
            { name: 'Seasonal & Festive', code: 'SEASONAL', order: 13, categories: [
                    'Diwali Items', 'Holi Items', 'Christmas Items', 'Eid Items',
                    'Onam & Pongal', 'Gift Packs & Hampers', 'Decorations',
                ] },
            { name: 'Apparel & Clothing', code: 'APPAREL', order: 14, categories: [
                    'Mens Clothing', 'Womens Clothing', 'Kids Clothing',
                    'Innerwear & Socks', 'Nightwear', 'Handkerchiefs & Accessories',
                ] },
            { name: 'Kitchen & Cookware', code: 'KITCHEN', order: 15, categories: [
                    'Cookware', 'Bakeware', 'Kitchen Tools', 'Storage Containers',
                    'Water Bottles & Flasks', 'Pressure Cookers',
                ] },
            { name: 'General Merchandise', code: 'GENERAL', order: 16, categories: [
                    'Footwear', 'Bags & Luggage', 'Toys & Games', 'Gifts & Novelties',
                    'Candles & Match Box', 'Umbrellas', 'Miscellaneous',
                ] },
        ];
        let deptsSeeded = 0, catsSeeded = 0, subCatsSeeded = 0;
        for (const d of DEPT_SEED) {
            let dept = await this.prisma.department.findUnique({
                where: { businessId_code: { businessId, code: d.code } },
            });
            if (!dept) {
                dept = await this.prisma.department.create({
                    data: { businessId, name: d.name, code: d.code, sortOrder: d.order },
                });
                deptsSeeded++;
            }
            for (let ci = 0; ci < d.categories.length; ci++) {
                const catName = d.categories[ci];
                const catCode = `${d.code}_${(ci + 1).toString().padStart(2, '0')}`;
                const label = catName;
                let cat = await this.prisma.category.findFirst({
                    where: { businessId, name: catName, departmentId: dept.id, parentId: null },
                });
                if (!cat) {
                    let finalCode = catCode;
                    const codeExists = await this.prisma.category.findUnique({
                        where: { businessId_code: { businessId, code: catCode } },
                    });
                    if (codeExists)
                        finalCode = `${catCode}X`;
                    cat = await this.prisma.category.create({
                        data: {
                            businessId,
                            departmentId: dept.id,
                            name: catName,
                            code: finalCode,
                            label,
                            sortOrder: ci + 1,
                        },
                    });
                    catsSeeded++;
                }
                const exists = await this.prisma.category.findFirst({
                    where: { businessId, name: 'General', parentId: cat.id },
                });
                if (!exists) {
                    const subCode = `${cat.code}_GEN`;
                    let finalSubCode = subCode;
                    const subCodeExists = await this.prisma.category.findUnique({
                        where: { businessId_code: { businessId, code: subCode } },
                    });
                    if (subCodeExists)
                        finalSubCode = `${subCode}X`;
                    await this.prisma.category.create({
                        data: {
                            businessId,
                            departmentId: dept.id,
                            parentId: cat.id,
                            name: 'General',
                            code: finalSubCode,
                            label: 'General',
                            sortOrder: 1,
                        },
                    });
                    subCatsSeeded++;
                }
            }
        }
        return {
            message: `Seeded ${deptsSeeded} depts, ${catsSeeded} cats, ${subCatsSeeded} sub-cats`,
            deptsSeeded,
            catsSeeded,
            subCatsSeeded,
        };
    }
    async repairProductPlus(businessId) {
        return this.prisma.$transaction(async (tx) => {
            const repairedLog = [];
            const updatedLog = [];
            const barcodesLinkedLog = [];
            const errors = [];
            const products = await tx.product.findMany({
                where: { businessId },
                orderBy: { productCode: 'asc' },
                include: {
                    plusList: true,
                    barcodes: { where: { isActive: true } },
                },
            });
            for (const product of products) {
                try {
                    const costPrice = Number(product.costPrice ?? 0);
                    const mrp = Number(product.mrp);
                    const sellingPrice = Number(product.sellingPrice);
                    const gstRate = product.gstRatePercent != null ? Number(product.gstRatePercent) : null;
                    const cessRate = Number(product.cessRate ?? 0);
                    const marginRs = mrp > 0 ? Math.round((mrp - costPrice) * 100) / 100 : 0;
                    const marginPct = mrp > 0 ? Math.round(((mrp - costPrice) / mrp) * 100 * 10000) / 10000 : 0;
                    const hasAnyPlu = product.plusList.length > 0;
                    if (!hasAnyPlu) {
                        const pluCode = `${product.productCode}001`;
                        const collision = await tx.productPlu.findFirst({
                            where: { businessId, pluCode },
                        });
                        if (collision) {
                            errors.push(`${product.productCode}: pluCode ${pluCode} already exists (id=${collision.id})`);
                            continue;
                        }
                        const newPlu = await tx.productPlu.create({
                            data: {
                                businessId,
                                productId: product.id,
                                pluCode,
                                basicCost: costPrice,
                                costPrice,
                                mrp,
                                sellingPrice,
                                wholesalePrice: null,
                                minSellingPrice: 0,
                                gstRate,
                                hsnCode: product.hsnCode,
                                cessRate,
                                taxInclusive: false,
                                marginPercent: marginPct,
                                marginRs,
                                stockOnHand: 0,
                                receivedQty: 0,
                                soldQty: 0,
                                isDefault: true,
                                isActive: true,
                                isArchived: false,
                                effectiveFrom: new Date(),
                                createdByName: 'System (repair)',
                            },
                        });
                        repairedLog.push(`${product.productCode} (${product.name}): PLU ${pluCode} id=${newPlu.id}`);
                        for (const barcode of product.barcodes) {
                            if (!barcode.pluId) {
                                await tx.productBarcode.update({
                                    where: { id: barcode.id },
                                    data: { pluId: newPlu.id },
                                });
                                barcodesLinkedLog.push(`${product.productCode}: barcode ${barcode.barcodeValue} → PLU ${pluCode}`);
                            }
                        }
                    }
                    else {
                        for (const plu of product.plusList) {
                            await tx.productPlu.update({
                                where: { id: plu.id },
                                data: {
                                    basicCost: Number(plu.costPrice),
                                    gstRate,
                                    hsnCode: product.hsnCode,
                                    cessRate,
                                    marginPercent: marginPct,
                                    marginRs,
                                    effectiveFrom: plu.createdAt,
                                },
                            });
                            updatedLog.push(`${product.productCode} (${product.name}): PLU ${plu.pluCode} updated`);
                            if (plu.isDefault) {
                                for (const barcode of product.barcodes) {
                                    if (!barcode.pluId) {
                                        await tx.productBarcode.update({
                                            where: { id: barcode.id },
                                            data: { pluId: plu.id },
                                        });
                                        barcodesLinkedLog.push(`${product.productCode}: barcode ${barcode.barcodeValue} → PLU ${plu.pluCode}`);
                                    }
                                }
                            }
                        }
                    }
                }
                catch (err) {
                    errors.push(`${product.productCode ?? product.id}: ${err.message}`);
                }
            }
            return {
                repaired: repairedLog.length,
                updated: updatedLog.length,
                barcodesLinked: barcodesLinkedLog.length,
                repairedLog,
                updatedLog,
                barcodesLinkedLog,
                errors,
            };
        }, { timeout: 60000 });
    }
    async migrateOrphansPhase1(businessId) {
        return this.prisma.$transaction(async (tx) => {
            const summary = {
                brand: 'already_existed',
                brandId: '',
                deptsCreated: [],
                catsCreated: [],
                subCatsCreated: [],
                productsMovedLog: [],
            };
            let brand = await tx.brand.findFirst({ where: { businessId, name: 'Srivani' } });
            if (!brand) {
                brand = await tx.brand.create({
                    data: { businessId, name: 'Srivani', code: 'SRIVANI', isActive: true },
                });
                summary.brand = 'created';
            }
            summary.brandId = brand.id;
            const NEW_DEPTS = [
                { code: 'SUPPLIES', name: 'Raw Materials & Packaging', order: 17 },
                { code: 'TELECOM', name: 'Telecom & Recharge', order: 18 },
            ];
            const deptMap = {};
            for (const d of NEW_DEPTS) {
                let dept = await tx.department.findUnique({
                    where: { businessId_code: { businessId, code: d.code } },
                });
                if (!dept) {
                    dept = await tx.department.create({
                        data: { businessId, name: d.name, code: d.code, sortOrder: d.order, isActive: true },
                    });
                    summary.deptsCreated.push(`${d.code}:${dept.id}`);
                }
                deptMap[d.code] = { id: dept.id, code: dept.code };
            }
            const NEW_CAT_DEFS = [
                { deptCode: 'SUPPLIES', name: 'Raw Sugar & Sweeteners', codeBase: 'SUPPLIES_01', sortOrder: 1 },
                { deptCode: 'SUPPLIES', name: 'Raw Pulses & Dal', codeBase: 'SUPPLIES_02', sortOrder: 2 },
                { deptCode: 'SUPPLIES', name: 'Raw Rice & Grains', codeBase: 'SUPPLIES_03', sortOrder: 3 },
                { deptCode: 'SUPPLIES', name: 'Raw Spices & Masalas', codeBase: 'SUPPLIES_04', sortOrder: 4 },
                { deptCode: 'SUPPLIES', name: 'Raw Dry Fruits & Nuts', codeBase: 'SUPPLIES_05', sortOrder: 5 },
                { deptCode: 'SUPPLIES', name: 'Raw Oils & Ghee (bulk)', codeBase: 'SUPPLIES_06', sortOrder: 6 },
                { deptCode: 'SUPPLIES', name: 'Packaging Pouches', codeBase: 'SUPPLIES_07', sortOrder: 7 },
                { deptCode: 'SUPPLIES', name: 'Labels & Stickers', codeBase: 'SUPPLIES_08', sortOrder: 8 },
                { deptCode: 'SUPPLIES', name: 'Boxes & Cartons', codeBase: 'SUPPLIES_09', sortOrder: 9 },
                { deptCode: 'SUPPLIES', name: 'Twine & Tape', codeBase: 'SUPPLIES_10', sortOrder: 10 },
                { deptCode: 'SUPPLIES', name: 'Other Packaging Supplies', codeBase: 'SUPPLIES_11', sortOrder: 11 },
                { deptCode: 'TELECOM', name: 'Prepaid Mobile Recharge', codeBase: 'TELECOM_01', sortOrder: 1 },
                { deptCode: 'TELECOM', name: 'Postpaid Bill Payment', codeBase: 'TELECOM_02', sortOrder: 2 },
                { deptCode: 'TELECOM', name: 'DTH Recharge', codeBase: 'TELECOM_03', sortOrder: 3 },
                { deptCode: 'TELECOM', name: 'Gift Cards & Vouchers', codeBase: 'TELECOM_04', sortOrder: 4 },
                { deptCode: 'TELECOM', name: 'FASTag Recharge', codeBase: 'TELECOM_05', sortOrder: 5 },
                { deptCode: 'TELECOM', name: 'SIM Cards & New Connections', codeBase: 'TELECOM_06', sortOrder: 6 },
                { deptCode: 'TELECOM', name: 'Utility Bill Payments', codeBase: 'TELECOM_07', sortOrder: 7 },
            ];
            const catMap = {};
            for (const def of NEW_CAT_DEFS) {
                const dept = deptMap[def.deptCode];
                let cat = await tx.category.findFirst({
                    where: { businessId, name: def.name, departmentId: dept.id, parentId: null },
                });
                if (!cat) {
                    let code = def.codeBase;
                    const codeExists = await tx.category.findUnique({ where: { businessId_code: { businessId, code } } });
                    if (codeExists)
                        code = `${code}X`;
                    cat = await tx.category.create({
                        data: { businessId, departmentId: dept.id, name: def.name, code, label: def.name, sortOrder: def.sortOrder, isActive: true },
                    });
                    summary.catsCreated.push(`${code}:${cat.id}`);
                }
                catMap[`${def.deptCode}::${def.name}`] = { id: cat.id, code: cat.code, departmentId: dept.id };
            }
            for (const [, cat] of Object.entries(catMap)) {
                const exists = await tx.category.findFirst({ where: { businessId, name: 'General', parentId: cat.id } });
                if (!exists) {
                    let subCode = `${cat.code}_GEN`;
                    const subCodeExists = await tx.category.findUnique({ where: { businessId_code: { businessId, code: subCode } } });
                    if (subCodeExists)
                        subCode = `${subCode}X`;
                    const sub = await tx.category.create({
                        data: { businessId, departmentId: cat.departmentId, parentId: cat.id, name: 'General', code: subCode, label: 'General', sortOrder: 1, isActive: true },
                    });
                    summary.subCatsCreated.push(`${subCode}:${sub.id}`);
                }
            }
            const PRODUCT_MAP = [
                { oldName: 'Skincare & Face', deptCode: 'PERSONAL', catName: 'Skin Care' },
                { oldName: 'Sunflower Oil', deptCode: 'FOOD', catName: 'Oils & Ghee' },
                { oldName: 'Groundnut Oil', deptCode: 'FOOD', catName: 'Oils & Ghee' },
                { oldName: 'Wheat & Atta', deptCode: 'FOOD', catName: 'Staples & Grains' },
                { oldName: 'Olive Oil', deptCode: 'FOOD', catName: 'Oils & Ghee' },
                { oldName: 'Toothpaste & Brush', deptCode: 'PERSONAL', catName: 'Oral Care' },
                { oldName: 'Shampoo & Hair', deptCode: 'PERSONAL', catName: 'Hair Care' },
                { oldName: 'Chips & Crisps', deptCode: 'FOOD', catName: 'Snacks & Namkeen' },
                { oldName: 'Dishwash', deptCode: 'HOMECARE', catName: 'Dishwash' },
                { oldName: 'Milk', deptCode: 'FOOD', catName: 'Dairy & Eggs' },
                { oldName: 'Salt & Seasoning', deptCode: 'FOOD', catName: 'Cooking Essentials' },
            ];
            for (const m of PRODUCT_MAP) {
                const oldSubCat = await tx.category.findFirst({
                    where: { businessId, name: m.oldName, departmentId: null, parentId: { not: null } },
                });
                if (!oldSubCat)
                    continue;
                const targetDept = await tx.department.findUnique({
                    where: { businessId_code: { businessId, code: m.deptCode } },
                });
                if (!targetDept)
                    continue;
                const targetCat = await tx.category.findFirst({
                    where: { businessId, name: m.catName, departmentId: targetDept.id, parentId: null },
                });
                if (!targetCat)
                    continue;
                const targetSubCat = await tx.category.findFirst({
                    where: { businessId, name: 'General', parentId: targetCat.id },
                });
                if (!targetSubCat)
                    continue;
                const products = await tx.product.findMany({
                    where: { businessId, categoryId: oldSubCat.id },
                    select: { id: true, name: true },
                });
                for (const p of products) {
                    await tx.product.update({
                        where: { id: p.id },
                        data: { departmentId: targetDept.id, categoryId: targetSubCat.id },
                    });
                    summary.productsMovedLog.push({
                        productId: p.id, name: p.name,
                        oldCategoryId: oldSubCat.id, oldCategoryName: m.oldName,
                        newDepartmentId: targetDept.id, newDepartmentCode: m.deptCode,
                        newCategoryId: targetSubCat.id, newCategoryName: 'General', newParentName: m.catName,
                    });
                }
            }
            return {
                message: 'Phase 1 migration complete',
                brand: summary.brand,
                brandId: summary.brandId,
                deptsCreated: summary.deptsCreated.length,
                deptsCreatedIds: summary.deptsCreated,
                catsCreated: summary.catsCreated.length,
                catsCreatedIds: summary.catsCreated,
                subCatsCreated: summary.subCatsCreated.length,
                subCatsCreatedIds: summary.subCatsCreated,
                productsMoved: summary.productsMovedLog.length,
                productsMovedLog: summary.productsMovedLog,
            };
        }, { timeout: 60000 });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map