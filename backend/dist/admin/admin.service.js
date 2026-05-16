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
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map