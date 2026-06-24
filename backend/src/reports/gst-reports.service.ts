import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const r2 = (n: number) => Math.round(n * 100) / 100;

const GSTR1_VERSION  = 'GST3.0.4';
const B2CL_THRESHOLD = 250000; // ₹2.5 lakh — inter-state B2C above this goes to Table 5 (b2cl)

// Valid GSTIN format: 2-digit state + 5-letter PAN chars + 4-digit PAN + entity + Z + check
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── GST-standard UQC codes (as per GST portal / offline tool) ───────────────

const UOM_MAP: Record<string, string> = {
  nos: 'NOS', no: 'NOS', number: 'NOS', numbers: 'NOS',
  unit: 'NOS', units: 'NOS', pcs: 'NOS', pc: 'NOS',
  piece: 'NOS', pieces: 'NOS', each: 'NOS',
  kg: 'KGS', kgs: 'KGS', kilogram: 'KGS', kilograms: 'KGS',
  gm: 'GMS', gms: 'GMS', gram: 'GMS', grams: 'GMS', g: 'GMS',
  ltr: 'LTR', liter: 'LTR', litre: 'LTR', liters: 'LTR', litres: 'LTR', l: 'LTR',
  ml: 'MLT', milliliter: 'MLT', millilitre: 'MLT', milliliters: 'MLT', millilitres: 'MLT',
  mtr: 'MTR', meter: 'MTR', metre: 'MTR', meters: 'MTR', metres: 'MTR',
  box: 'BOX', boxes: 'BOX', bx: 'BOX',
  pac: 'PAC', pack: 'PAC', packet: 'PAC', packets: 'PAC', pkt: 'PAC', pkts: 'PAC',
  ctn: 'CTN', carton: 'CTN', cartons: 'CTN',
  bag: 'BAG', bags: 'BAG',
  doz: 'DOZ', dozen: 'DOZ', dozens: 'DOZ',
  set: 'SET', sets: 'SET',
  btl: 'BTL', bottle: 'BTL', bottles: 'BTL',
  ton: 'TON', tons: 'TON', tonne: 'TON', tonnes: 'TON', mt: 'TON',
  qtl: 'QTL', quintal: 'QTL', quintals: 'QTL',
  rol: 'ROL', roll: 'ROL', rolls: 'ROL',
  sqf: 'SQF', sqft: 'SQF',
  sqm: 'SQM',
  tin: 'TIN', tins: 'TIN',
  tub: 'TUB', tubs: 'TUB',
  bdl: 'BDL', bundle: 'BDL', bundles: 'BDL',
};

function normalizeUom(uom: string | null | undefined): string {
  if (!uom) return 'NOS';
  const key = uom.toLowerCase().trim();
  return UOM_MAP[key] ?? 'OTH';
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class GstReportsService {
  constructor(private prisma: PrismaService) {}

  private getPeriodDates(month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59, 999);
    const period    = `${MONTH_NAMES[month - 1]} ${year}`;
    return { startDate, endDate, period };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PREFLIGHT: Validate all GST data before filing. Returns errors (blocking)
  // and warnings (non-blocking). Frontend runs this before allowing JSON download.
  // ─────────────────────────────────────────────────────────────────────────────

  async preflight(businessId: string, month: number, year: number) {
    const { startDate, endDate, period } = this.getPeriodDates(month, year);

    const [biz, itemsWithoutHsn, crossVoidCount, distinctUoms, b2bNoGstinCount] = await Promise.all([
      this.prisma.business.findUnique({
        where:  { id: businessId },
        select: { gstin: true, stateCode: true, name: true },
      }),
      // Items sold this period with no HSN code
      this.prisma.salesItem.findMany({
        where: {
          bill: {
            businessId,
            billDate: { gte: startDate, lte: endDate },
            status:   'FINAL' as any,
            isVoided: false,
          },
          OR: [{ hsnCode: null }, { hsnCode: '' }],
        },
        select: { productName: true },
      }),
      // Bills voided THIS period but originally issued in a PRIOR period (need credit notes)
      this.prisma.salesBill.count({
        where: {
          businessId,
          isVoided:  true,
          voidedAt:  { gte: startDate, lte: endDate },
          billDate:  { lt: startDate },
          status:    'FINAL' as any,
          billType:  { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
        },
      }),
      // Distinct UOM values sold this period (to check for OTH mappings)
      this.prisma.salesItem.findMany({
        where: {
          bill: {
            businessId,
            billDate: { gte: startDate, lte: endDate },
            status:   'FINAL' as any,
            isVoided: false,
          },
        },
        select:   { unitOfMeasure: true },
        distinct: ['unitOfMeasure'],
      }),
      // B2B-flagged bills that have no customer GSTIN (can't appear in GSTR-1 b2b section)
      this.prisma.salesBill.count({
        where: {
          businessId,
          billDate:      { gte: startDate, lte: endDate },
          status:        'FINAL' as any,
          isVoided:      false,
          isB2B:         true,
          customerGstin: null,
        },
      }),
    ]);

    const errors:   string[] = [];
    const warnings: string[] = [];

    // ── GSTIN checks ──────────────────────────────────────────────────────────
    if (!biz?.gstin) {
      errors.push('Business GSTIN is not set. Go to Settings → Business to add your GSTIN before filing.');
    } else if (!GSTIN_REGEX.test(biz.gstin)) {
      errors.push(
        `Business GSTIN '${biz.gstin}' is in invalid format. ` +
        `Expected: 2-digit state + 10-char PAN + Z + check digit (15 chars total, e.g. 36AABCS1429B1Z1).`,
      );
    }

    if (!biz?.stateCode) {
      errors.push('Business state code is not set. Go to Settings → Business to set your state.');
    }

    // ── HSN warnings ──────────────────────────────────────────────────────────
    const productsWithoutHsn = [...new Set(itemsWithoutHsn.map((i) => i.productName))];
    if (productsWithoutHsn.length > 0) {
      warnings.push(
        `${productsWithoutHsn.length} product(s) sold this period have no HSN code. ` +
        `They will be excluded from the GSTR-1 HSN table (still counted in B2B/B2CS totals). ` +
        `Update HSN codes in product master to include them.`,
      );
    }

    // ── OTH UOM warning ───────────────────────────────────────────────────────
    const othUoms = distinctUoms
      .map((i) => i.unitOfMeasure)
      .filter((u) => normalizeUom(u) === 'OTH');
    if (othUoms.length > 0) {
      warnings.push(
        `UOM value(s) [${othUoms.slice(0, 5).join(', ')}] will be reported as 'OTH' in HSN summary. ` +
        `'OTH' is accepted by the portal but is less specific. Update product UOM to standard codes (KGS, NOS, LTR, etc.) for cleaner HSN data.`,
      );
    }

    // ── Credit note warning ───────────────────────────────────────────────────
    if (crossVoidCount > 0) {
      warnings.push(
        `${crossVoidCount} bill(s) were voided this period but originally issued in a prior period. ` +
        `They will appear as credit notes (cdnr/cdnur) in the GSTR-1 JSON automatically.`,
      );
    }

    // ── B2B bills without GSTIN ───────────────────────────────────────────────
    if (b2bNoGstinCount > 0) {
      warnings.push(
        `${b2bNoGstinCount} bill(s) are flagged as B2B but have no customer GSTIN. ` +
        `These will be reported as B2C in GSTR-1 (since there is no GSTIN to link them to). ` +
        `Open each bill and enter the customer GSTIN to report them correctly as B2B.`,
      );
    }

    return {
      period,
      businessGstin:     biz?.gstin ?? null,
      businessState:     biz?.stateCode ?? null,
      errors,
      warnings,
      productsWithoutHsn,
      crossPeriodVoids:  crossVoidCount,
      b2bNoGstinCount,
      isReadyToFile:     errors.length === 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ITC CARRY-FORWARD: Computes opening ITC balance by running through each month
  // from the start of the financial year to the month before the filing period.
  // FY = April to March (Indian GST financial year).
  // Algorithm: each month, excess ITC (itcAvailable - outwardTax) carries forward.
  // ─────────────────────────────────────────────────────────────────────────────

  private async computeOpeningITC(businessId: string, month: number, year: number): Promise<number> {
    // GST FY starts in April
    const fyStartYear  = month >= 4 ? year : year - 1;
    const fyStartMonth = 4;

    let carry = 0;
    let m = fyStartMonth;
    let y = fyStartYear;

    while (y < year || (y === year && m < month)) {
      const { startDate, endDate } = this.getPeriodDates(m, y);

      const [outAgg, itcAgg] = await Promise.all([
        this.prisma.salesBill.aggregate({
          where: {
            businessId,
            billDate: { gte: startDate, lte: endDate },
            status:   'FINAL' as any,
            isVoided: false,
            billType: { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
          },
          _sum: { cgstTotal: true, sgstTotal: true, igstTotal: true, cessTotal: true },
        }),
        this.prisma.purchase.aggregate({
          where: {
            businessId,
            status:         'APPROVED' as any,
            invoiceDate:    { gte: startDate, lte: endDate },
            itcEligibility: { not: 'NOT_ELIGIBLE' },
          },
          _sum: { cgstTotal: true, sgstTotal: true, igstTotal: true, cessTotal: true },
        }),
      ]);

      const outTax = r2(
        Number(outAgg._sum.cgstTotal ?? 0) + Number(outAgg._sum.sgstTotal ?? 0) +
        Number(outAgg._sum.igstTotal ?? 0) + Number(outAgg._sum.cessTotal ?? 0),
      );
      const itcAmt = r2(
        Number(itcAgg._sum.cgstTotal ?? 0) + Number(itcAgg._sum.sgstTotal ?? 0) +
        Number(itcAgg._sum.igstTotal ?? 0) + Number(itcAgg._sum.cessTotal ?? 0),
      );

      // Positive net = excess ITC not yet used → carry forward
      carry = r2(Math.max(0, carry + itcAmt - outTax));

      m++;
      if (m > 12) { m = 1; y++; }
    }

    return carry;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METHOD 1: Sales Register
  // ─────────────────────────────────────────────────────────────────────────────

  async getSalesRegister(businessId: string, month: number, year: number) {
    const { startDate, endDate, period } = this.getPeriodDates(month, year);

    const [biz, bills] = await Promise.all([
      this.prisma.business.findUnique({
        where:  { id: businessId },
        select: { gstin: true, stateCode: true, name: true },
      }),
      this.prisma.salesBill.findMany({
        where: {
          businessId,
          billDate: { gte: startDate, lte: endDate },
          status:   'FINAL' as any,
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
      }),
    ]);

    const bizStateCode = biz?.stateCode ?? '36';

    const buildItemsByRate = (billItems: typeof bills[0]['items']) => {
      const rateMap = new Map<number, { txval: number; camt: number; samt: number; iamt: number; csamt: number }>();
      for (const item of billItems) {
        const rt  = Number(item.gstRatePercent);
        const cur = rateMap.get(rt) ?? { txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0 };
        rateMap.set(rt, {
          txval: r2(cur.txval + Number(item.taxableAmount)),
          camt:  r2(cur.camt  + Number(item.cgstAmount)),
          samt:  r2(cur.samt  + Number(item.sgstAmount)),
          iamt:  r2(cur.iamt  + Number(item.igstAmount)),
          csamt: r2(cur.csamt + Number(item.cessAmount)),
        });
      }
      return [...rateMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([rt, vals], idx) => ({ num: idx + 1, rt, ...vals }));
    };

    // B2B
    const b2b = bills
      .filter((b) => b.isB2B || !!b.customerGstin)
      .map((b) => {
        const pos     = b.supplyStateCode ?? bizStateCode;
        const isInter = pos !== bizStateCode;
        return {
          billNumber:      b.billNumber ?? '',
          billDate:        b.billDate.toISOString(),
          customerName:    b.customerName ?? 'Walk-in',
          customerGstin:   b.customerGstin ?? '',
          supplyStateCode: pos,
          isInterState:    isInter,
          billType:        b.billType,
          taxableAmount:   Number(b.taxableAmount),
          cgst:            Number(b.cgstTotal),
          sgst:            Number(b.sgstTotal),
          igst:            Number(b.igstTotal),
          cess:            Number(b.cessTotal),
          grandTotal:      Number(b.grandTotal),
          itemsByRate:     buildItemsByRate(b.items),
        };
      });

    // B2C: split Large vs Small
    const b2cBills = bills.filter((b) => !b.isB2B && !b.customerGstin);

    const b2clMap = new Map<string, {
      pos: string;
      invoices: { inum: string; idt: string; val: number; itemsByRate: ReturnType<typeof buildItemsByRate> }[];
    }>();

    const b2csMap = new Map<string, {
      splyTp: string; pos: string; gstRate: number;
      taxableAmount: number; cgst: number; sgst: number; igst: number; cess: number; count: number;
    }>();

    for (const bill of b2cBills) {
      const pos        = bill.supplyStateCode ?? bizStateCode;
      const isInter    = pos !== bizStateCode;
      const grandTotal = Number(bill.grandTotal);

      const effectiveItems: ReturnType<typeof buildItemsByRate> =
        (bill as any).isHistorical && bill.items.length === 0
          ? (() => {
              let gstRate = 0;
              try { const n = JSON.parse((bill as any).notes ?? '{}'); gstRate = Number(n.gstRate ?? 0); } catch { /* skip */ }
              return [{ num: 1, rt: gstRate,
                txval: Number(bill.taxableAmount), camt: Number(bill.cgstTotal),
                samt: Number(bill.sgstTotal), iamt: Number(bill.igstTotal), csamt: Number(bill.cessTotal),
              }];
            })()
          : buildItemsByRate(bill.items);

      if (isInter && grandTotal > B2CL_THRESHOLD) {
        const grp = b2clMap.get(pos) ?? { pos, invoices: [] };
        grp.invoices.push({ inum: bill.billNumber ?? '', idt: fmtDate(bill.billDate), val: grandTotal, itemsByRate: effectiveItems });
        b2clMap.set(pos, grp);
        continue;
      }

      for (const item of effectiveItems) {
        const splyTp = isInter ? 'INTER' : 'INTRA';
        const key    = `${splyTp}__${pos}__${item.rt}`;
        const cur    = b2csMap.get(key) ?? { splyTp, pos, gstRate: item.rt, taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, cess: 0, count: 0 };
        b2csMap.set(key, {
          ...cur,
          taxableAmount: r2(cur.taxableAmount + item.txval),
          cgst:          r2(cur.cgst  + item.camt),
          sgst:          r2(cur.sgst  + item.samt),
          igst:          r2(cur.igst  + item.iamt),
          cess:          r2(cur.cess  + item.csamt),
          count:         cur.count + 1,
        });
      }
    }

    const b2cl = [...b2clMap.values()].sort((a, b) => a.pos.localeCompare(b.pos));
    const b2cs = [...b2csMap.values()].sort((a, b) => a.gstRate - b.gstRate);

    // HSN summary keyed by hsnCode+rate (one row per HSN+rate as required by portal)
    type HsnEntry = {
      hsnCode: string; description: string; uom: string; gstRate: number;
      totalQty: number; taxableAmount: number;
      cgst: number; sgst: number; igst: number; cess: number;
    };
    const hsnMap = new Map<string, HsnEntry>();

    for (const bill of bills) {
      for (const item of bill.items) {
        const hsn  = item.hsnCode ?? 'UNCLASSIFIED';
        const rate = Number(item.gstRatePercent);
        const key  = `${hsn}|${rate}`;
        const cur  = hsnMap.get(key) ?? {
          hsnCode:       hsn,
          description:   item.productName,
          uom:           normalizeUom(item.unitOfMeasure),
          gstRate:       rate,
          totalQty:      0, taxableAmount: 0,
          cgst:          0, sgst: 0, igst: 0, cess: 0,
        };
        hsnMap.set(key, {
          ...cur,
          totalQty:      r2(cur.totalQty      + Number(item.quantity)),
          taxableAmount: r2(cur.taxableAmount  + Number(item.taxableAmount)),
          cgst:          r2(cur.cgst           + Number(item.cgstAmount)),
          sgst:          r2(cur.sgst           + Number(item.sgstAmount)),
          igst:          r2(cur.igst           + Number(item.igstAmount)),
          cess:          r2(cur.cess           + Number(item.cessAmount)),
        });
      }
    }

    const hsnSummary = [...hsnMap.values()]
      .map((h) => ({ ...h, totalTax: r2(h.cgst + h.sgst + h.igst + h.cess) }))
      .sort((a, b) => a.hsnCode.localeCompare(b.hsnCode));

    const totals = {
      totalBills:      bills.length,
      totalTaxable:    r2(bills.reduce((s, b) => s + Number(b.taxableAmount), 0)),
      totalCgst:       r2(bills.reduce((s, b) => s + Number(b.cgstTotal),    0)),
      totalSgst:       r2(bills.reduce((s, b) => s + Number(b.sgstTotal),    0)),
      totalIgst:       r2(bills.reduce((s, b) => s + Number(b.igstTotal),    0)),
      totalCess:       r2(bills.reduce((s, b) => s + Number(b.cessTotal),    0)),
      totalGrandTotal: r2(bills.reduce((s, b) => s + Number(b.grandTotal),   0)),
      b2bCount:        b2b.length,
      b2clCount:       b2cl.reduce((s, g) => s + g.invoices.length, 0),
      b2csCount:       b2cBills.length - b2cl.reduce((s, g) => s + g.invoices.length, 0),
    };

    return { period, bizStateCode, b2b, b2cl, b2cs, hsnSummary, totals };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METHOD 2: Purchase Register
  // ─────────────────────────────────────────────────────────────────────────────

  async getPurchaseRegister(businessId: string, month: number, year: number) {
    const { startDate, endDate, period } = this.getPeriodDates(month, year);

    const purchases = await this.prisma.purchase.findMany({
      where: {
        businessId,
        status:      'APPROVED' as any,
        invoiceDate: { gte: startDate, lte: endDate },
      },
      orderBy: { invoiceDate: 'asc' },
    });

    const purchaseList = purchases.map((p) => {
      const eligible = p.itcEligibility !== 'NOT_ELIGIBLE';
      return {
        grnNumber:      p.grnNumber ?? '',
        grnDate:        (p.approvedAt ?? p.invoiceDate).toISOString(),
        supplierName:   p.supplierName,
        supplierGstin:  p.supplierGstin ?? '',
        invoiceNumber:  p.invoiceNumber,
        invoiceDate:    p.invoiceDate.toISOString(),
        isInterState:   p.isInterState,
        itcEligibility: p.itcEligibility,
        taxableAmount:  Number(p.taxableAmount),
        cgst:           Number(p.cgstTotal),
        sgst:           Number(p.sgstTotal),
        igst:           Number(p.igstTotal),
        cess:           Number(p.cessTotal),
        totalAmount:    Number(p.grandTotal),
        itcClaimed:     eligible ? Number(p.totalTaxAmount) : 0,
        itcCgst:        eligible ? Number(p.cgstTotal) : 0,
        itcSgst:        eligible ? Number(p.sgstTotal) : 0,
        itcIgst:        eligible ? Number(p.igstTotal) : 0,
        itcCess:        eligible ? Number(p.cessTotal) : 0,
      };
    });

    const eligible   = purchases.filter((p) => p.itcEligibility !== 'NOT_ELIGIBLE');
    const ineligible = purchases.filter((p) => p.itcEligibility === 'NOT_ELIGIBLE');

    const summary = {
      totalPurchases:  purchases.length,
      totalTaxable:    r2(purchases.reduce((s, p)  => s + Number(p.taxableAmount), 0)),
      eligibleITC:     r2(eligible.reduce((s, p)   => s + Number(p.totalTaxAmount), 0)),
      ineligibleITC:   r2(ineligible.reduce((s, p) => s + Number(p.totalTaxAmount), 0)),
      cgstITC:         r2(eligible.reduce((s, p)   => s + Number(p.cgstTotal), 0)),
      sgstITC:         r2(eligible.reduce((s, p)   => s + Number(p.sgstTotal), 0)),
      igstITC:         r2(eligible.reduce((s, p)   => s + Number(p.igstTotal), 0)),
      cessITC:         r2(eligible.reduce((s, p)   => s + Number(p.cessTotal), 0)),
      // Per-head ineligible ITC — exposed as GSTR-3B Table 4(D)(2) disclosure
      ineligibleCgst:  r2(ineligible.reduce((s, p) => s + Number(p.cgstTotal), 0)),
      ineligibleSgst:  r2(ineligible.reduce((s, p) => s + Number(p.sgstTotal), 0)),
      ineligibleIgst:  r2(ineligible.reduce((s, p) => s + Number(p.igstTotal), 0)),
      ineligibleCess:  r2(ineligible.reduce((s, p) => s + Number(p.cessTotal), 0)),
    };

    return { period, purchases: purchaseList, summary };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METHOD 3: GSTR-3B Summary
  // Opening ITC balance is computed automatically from FY start (not manual).
  // ─────────────────────────────────────────────────────────────────────────────

  async getGSTR3BSummary(businessId: string, month: number, year: number) {
    const [sales, purchase, openingITC] = await Promise.all([
      this.getSalesRegister(businessId, month, year),
      this.getPurchaseRegister(businessId, month, year),
      this.computeOpeningITC(businessId, month, year),
    ]);

    type TaxBox = { taxable: number; cgst: number; sgst: number; igst: number; cess: number };
    const zero: TaxBox = { taxable: 0, cgst: 0, sgst: 0, igst: 0, cess: 0 };
    const add = (a: TaxBox, b: Partial<TaxBox>): TaxBox => ({
      taxable: r2((a.taxable) + (b.taxable ?? 0)),
      cgst:    r2(a.cgst  + (b.cgst  ?? 0)),
      sgst:    r2(a.sgst  + (b.sgst  ?? 0)),
      igst:    r2(a.igst  + (b.igst  ?? 0)),
      cess:    r2(a.cess  + (b.cess  ?? 0)),
    });

    const b2bOut = sales.b2b.reduce((acc, b) =>
      add(acc, { taxable: b.taxableAmount, cgst: b.cgst, sgst: b.sgst, igst: b.igst, cess: b.cess }),
      { ...zero });

    const b2csOut = sales.b2cs.reduce((acc, b) =>
      add(acc, { taxable: b.taxableAmount, cgst: b.cgst, sgst: b.sgst, igst: b.igst, cess: b.cess }),
      { ...zero });

    const b2clOut = sales.b2cl.reduce((acc, grp) =>
      grp.invoices.reduce((a2, inv) =>
        inv.itemsByRate.reduce((a3, item) =>
          add(a3, { taxable: item.txval, cgst: item.camt, sgst: item.samt, igst: item.iamt, cess: item.csamt }),
          a2), acc), { ...zero });

    const b2cOut:   TaxBox = add(b2csOut, b2clOut);
    const totalOut: TaxBox = add(b2bOut, b2cOut);

    // 3.2 Inter-state supplies to unregistered
    const interSmall = sales.b2cs
      .filter((b) => b.splyTp === 'INTER')
      .reduce((acc, b) => add(acc, { taxable: b.taxableAmount, igst: b.igst, cess: b.cess }), { ...zero });

    const interLarge = sales.b2cl.reduce((acc, grp) =>
      grp.invoices.reduce((a2, inv) =>
        inv.itemsByRate.reduce((a3, item) =>
          add(a3, { taxable: item.txval, igst: item.iamt, cess: item.csamt }),
          a2), acc), { ...zero });

    const section32: TaxBox = add(interSmall, interLarge);

    // 4 ITC
    const itc = {
      cgst:  purchase.summary.cgstITC,
      sgst:  purchase.summary.sgstITC,
      igst:  purchase.summary.igstITC,
      cess:  purchase.summary.cessITC,
      total: r2(purchase.summary.cgstITC + purchase.summary.sgstITC + purchase.summary.igstITC + purchase.summary.cessITC),
    };

    // Net payable (from this period's tax minus this period's ITC)
    const netPayable = {
      cgst:  r2(Math.max(0, totalOut.cgst - itc.cgst)),
      sgst:  r2(Math.max(0, totalOut.sgst - itc.sgst)),
      igst:  r2(Math.max(0, totalOut.igst - itc.igst)),
      cess:  r2(Math.max(0, totalOut.cess - itc.cess)),
      total: 0,
    };
    netPayable.total = r2(netPayable.cgst + netPayable.sgst + netPayable.igst + netPayable.cess);

    const itcUsed = r2(
      Math.min(itc.cgst, totalOut.cgst) +
      Math.min(itc.sgst, totalOut.sgst) +
      Math.min(itc.igst, totalOut.igst) +
      Math.min(itc.cess, totalOut.cess),
    );

    // Total ITC available = prior months carry-forward + this month ITC
    const totalItcAvailable  = r2(openingITC + itc.total);
    const totalOutwardTaxAmt = r2(totalOut.cgst + totalOut.sgst + totalOut.igst + totalOut.cess);
    // Closing = opening + claimed - consumed. Consumed = min(totalAvailable, totalOutwardTax).
    const closingBalance = r2(Math.max(0, totalItcAvailable - totalOutwardTaxAmt));

    // Net cash payable after applying opening ITC balance
    const netPayableAfterOpening = r2(Math.max(0, netPayable.total - openingITC));

    return {
      period: sales.period,
      outwardSupplies: { b2b: b2bOut, b2c: b2cOut, total: totalOut },
      reverseCharge: { cgst: 0, sgst: 0, igst: 0, note: 'Fill from RCM purchase invoices if any' },
      interStateUnregistered: section32,
      itcAvailable: {
        fromPurchases: itc,
        eligible:      itc,
        reversal:      { cgst: 0, sgst: 0, igst: 0, cess: 0 },
        net:           itc,
        // GSTR-3B Table 4(D)(2) — Ineligible ITC under Section 17(5) (disclosure only, not deducted from net)
        ineligibleDisclosure: {
          cgst:  purchase.summary.ineligibleCgst,
          sgst:  purchase.summary.ineligibleSgst,
          igst:  purchase.summary.ineligibleIgst,
          cess:  purchase.summary.ineligibleCess,
          total: purchase.summary.ineligibleITC,
          note:  'Section 17(5) blocked ITC — disclosed but not claimed (already excluded from eligible total)',
        },
      },
      netPayable,
      creditLedger: {
        openingBalance:         openingITC,    // auto-computed from FY start
        openingBalanceNote:     month === 4 ? 'April — first month of FY, no carry-forward' : `Carried from ${MONTH_NAMES[(month - 2 + 12) % 12]} (auto-computed)`,
        itcClaimed:             itc.total,
        itcUsed,
        closingBalance,
        netPayableAfterOpening, // what you actually pay in cash after using opening balance
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METHOD 4: HSN Summary
  // ─────────────────────────────────────────────────────────────────────────────

  async getHSNSummary(businessId: string, month: number, year: number) {
    const { startDate, endDate, period } = this.getPeriodDates(month, year);

    const items = await this.prisma.salesItem.findMany({
      where: {
        bill: {
          businessId,
          billDate:  { gte: startDate, lte: endDate },
          status:    'FINAL' as any,
          isVoided:  false,
          billType:  { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
        },
      },
    });

    type HsnRow = {
      hsnCode: string; gstRate: number; uom: string;
      totalQuantity: number; totalTaxableValue: number;
      cgst: number; sgst: number; igst: number; totalGST: number; totalCess: number;
    };

    const hsnMap = new Map<string, HsnRow>();

    for (const item of items) {
      const hsn  = item.hsnCode ?? 'UNCLASSIFIED';
      const rate = Number(item.gstRatePercent);
      const key  = `${hsn}|${rate}`;
      const cur  = hsnMap.get(key) ?? {
        hsnCode: hsn, gstRate: rate, uom: normalizeUom(item.unitOfMeasure),
        totalQuantity: 0, totalTaxableValue: 0,
        cgst: 0, sgst: 0, igst: 0, totalGST: 0, totalCess: 0,
      };
      const cgst = r2(cur.cgst + Number(item.cgstAmount));
      const sgst = r2(cur.sgst + Number(item.sgstAmount));
      const igst = r2(cur.igst + Number(item.igstAmount));
      hsnMap.set(key, {
        ...cur,
        totalQuantity:     r2(cur.totalQuantity     + Number(item.quantity)),
        totalTaxableValue: r2(cur.totalTaxableValue  + Number(item.taxableAmount)),
        cgst, sgst, igst,
        totalGST:  r2(cgst + sgst + igst),
        totalCess: r2(cur.totalCess + Number(item.cessAmount)),
      });
    }

    return {
      period,
      hsnData: [...hsnMap.values()].sort((a, b) => a.hsnCode.localeCompare(b.hsnCode)),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // METHOD 5: GSTR-1 JSON — 100% GST portal compatible (schema v GST3.0.4)
  //
  // Sections:
  //   version, hash, gstin, fp  — file header
  //   b2b    (Table 4)   B2B invoices grouped by customer GSTIN
  //   b2cl   (Table 5)   B2C Large: inter-state > ₹2.5 lakh
  //   b2cs   (Table 7)   B2C Small: everything else, consolidated by splyTp+pos+rate
  //   cdnr              Credit/Debit notes for registered buyers (B2B)
  //   cdnur             Credit/Debit notes for unregistered B2C Large
  //   hsn    (Table 12)  HSN summary (UNCLASSIFIED entries excluded — portal rejects them)
  //   nil    (Table 8)   Nil/exempt/non-GST — 4 supply types
  //   doc_issue (Table 13) Invoice series — mandatory for filing
  // ─────────────────────────────────────────────────────────────────────────────

  async getGSTR1Json(businessId: string, month: number, year: number) {
    const { startDate, endDate } = this.getPeriodDates(month, year);

    const [salesData, biz, periodBills, crossVoidBills] = await Promise.all([
      this.getSalesRegister(businessId, month, year),
      this.prisma.business.findUnique({
        where:  { id: businessId },
        select: { gstin: true, stateCode: true, name: true },
      }),
      // All bills (incl. voided) for doc_issue table
      this.prisma.salesBill.findMany({
        where: {
          businessId,
          billDate: { gte: startDate, lte: endDate },
          billType: { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
          status:   'FINAL' as any,
        },
        select:  { billNumber: true, isVoided: true },
        orderBy: { billNumber: 'asc' },
      }),
      // Bills voided THIS period but originally from a PRIOR period → credit notes
      this.prisma.salesBill.findMany({
        where: {
          businessId,
          isVoided: true,
          voidedAt: { gte: startDate, lte: endDate },
          billDate: { lt: startDate },
          status:   'FINAL' as any,
          billType: { in: ['TAX_INVOICE', 'RETAIL_INVOICE'] },
        },
        include: {
          items: {
            select: {
              taxableAmount: true, gstRatePercent: true,
              cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true,
            },
          },
        },
      }),
    ]);

    // ── GSTIN validation — hard block ────────────────────────────────────────
    if (!biz?.gstin) {
      throw new BadRequestException(
        'Business GSTIN is not set. Go to Settings → Business and add your GSTIN before generating GSTR-1.',
      );
    }
    if (!GSTIN_REGEX.test(biz.gstin)) {
      throw new BadRequestException(
        `Business GSTIN '${biz.gstin}' is in invalid format. ` +
        'GSTIN must be 15 characters: 2-digit state + 10-char PAN + Z + check digit.',
      );
    }

    const fp      = `${String(month).padStart(2, '0')}${year}`;
    const bizState = biz.stateCode ?? '36';

    // ── b2b (Table 4) ────────────────────────────────────────────────────────
    // Bills with isB2B=true but no customerGstin are rerouted to b2cs (can't be B2B without GSTIN).
    type B2csAccum = { sply_tp: string; pos: string; typ: string; rt: number; txval: number; camt: number; samt: number; iamt: number; csamt: number };
    const b2csOrphanMap = new Map<string, B2csAccum>();

    const b2bByGstin = new Map<string, typeof salesData.b2b>();
    for (const bill of salesData.b2b) {
      if (!bill.customerGstin) {
        const pos = bill.supplyStateCode ?? bizState;
        const splyTp   = pos !== bizState ? 'INTER' : 'INTRA';
        for (const r of bill.itemsByRate) {
          const key = `${splyTp}__${pos}__${r.rt}`;
          const cur = b2csOrphanMap.get(key) ?? { sply_tp: splyTp, pos, typ: 'OE', rt: r.rt, txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0 };
          b2csOrphanMap.set(key, { ...cur, txval: r2(cur.txval + r.txval), camt: r2(cur.camt + r.camt), samt: r2(cur.samt + r.samt), iamt: r2(cur.iamt + r.iamt), csamt: r2(cur.csamt + r.csamt) });
        }
        continue;
      }
      const list = b2bByGstin.get(bill.customerGstin) ?? [];
      list.push(bill);
      b2bByGstin.set(bill.customerGstin, list);
    }

    const b2b = [...b2bByGstin.entries()].map(([ctin, invList]) => ({
      ctin,
      inv: invList.map((bill) => ({
        inum:    bill.billNumber,
        idt:     fmtDate(new Date(bill.billDate)),
        val:     bill.grandTotal,
        pos:     bill.supplyStateCode,
        rchrg:   'N',
        inv_typ: 'R',
        itms: bill.itemsByRate.length > 0
          ? bill.itemsByRate.map((r) => ({
              num:     r.num,
              itm_det: {
                rt:    r.rt,
                txval: r.txval,
                ...(bill.isInterState
                  ? { iamt: r2(r.camt + r.samt + r.iamt) }
                  : { camt: r.camt, samt: r.samt }),
                csamt: r.csamt,
              },
            }))
          : [{ num: 1, itm_det: {
                rt: 0, txval: bill.taxableAmount,
                ...(bill.isInterState
                  ? { iamt: r2(bill.cgst + bill.sgst + bill.igst) }
                  : { camt: bill.cgst, samt: bill.sgst }),
                csamt: bill.cess,
              } }],
      })),
    }));

    // ── b2cl (Table 5) ───────────────────────────────────────────────────────
    const b2cl = salesData.b2cl.map((grp) => ({
      pos: grp.pos,
      inv: grp.invoices.map((inv) => ({
        inum: inv.inum,
        idt:  inv.idt,
        val:  inv.val,
        itms: inv.itemsByRate.map((r) => ({
          num:     r.num,
          itm_det: {
            rt:    r.rt,
            txval: r.txval,
            iamt:  r2(r.camt + r.samt + r.iamt),
            csamt: r.csamt,
          },
        })),
      })),
    }));

    // ── b2cs (Table 7) ───────────────────────────────────────────────────────
    const b2cs = [
      ...salesData.b2cs.map((b) => ({
        sply_tp: b.splyTp,
        pos:     b.pos,
        typ:     'OE',
        rt:      b.gstRate,
        txval:   b.taxableAmount,
        ...(b.splyTp === 'INTRA'
          ? { camt: b.cgst, samt: b.sgst }
          : { iamt: b.igst }),
        csamt: b.cess,
      })),
      // Orphan B2B bills (isB2B=true but no customerGstin) fall back to B2CS
      ...[...b2csOrphanMap.values()].map((o) => ({
        sply_tp: o.sply_tp,
        pos:     o.pos,
        typ:     o.typ,
        rt:      o.rt,
        txval:   o.txval,
        ...(o.sply_tp === 'INTRA'
          ? { camt: o.camt, samt: o.samt }
          : { iamt: o.iamt }),
        csamt: o.csamt,
      })),
    ];

    // ── cdnr: Credit notes for B2B (cross-period voids) ─────────────────────
    const cdnrByGstin = new Map<string, { ntty: string; nt_num: string; nt_dt: string; val: number; pos: string; rchrg: string; inv_typ: string; itms: object[] }[]>();

    for (const bill of crossVoidBills.filter((b) => b.customerGstin)) {
      const pos = bill.supplyStateCode ?? bizState;
      const isInter  = pos !== bizState;

      // Group items by GST rate
      const rateMap = new Map<number, { txval: number; camt: number; samt: number; iamt: number; csamt: number }>();
      for (const item of bill.items) {
        const rt  = Number(item.gstRatePercent);
        const cur = rateMap.get(rt) ?? { txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0 };
        rateMap.set(rt, {
          txval: r2(cur.txval + Number(item.taxableAmount)),
          camt:  r2(cur.camt  + Number(item.cgstAmount)),
          samt:  r2(cur.samt  + Number(item.sgstAmount)),
          iamt:  r2(cur.iamt  + Number(item.igstAmount)),
          csamt: r2(cur.csamt + Number(item.cessAmount)),
        });
      }

      const itms = [...rateMap.entries()].map(([rt, v], idx) => ({
        num: idx + 1,
        itm_det: {
          rt, txval: v.txval,
          ...(isInter ? { iamt: r2(v.camt + v.samt + v.iamt) } : { camt: v.camt, samt: v.samt }),
          csamt: v.csamt,
        },
      }));

      const nt = {
        ntty:     'C',
        nt_num:   `CN/${(bill.billNumber ?? 'VOID').slice(0, 13)}`,  // max 16 chars total
        nt_dt:    fmtDate(bill.voidedAt ?? bill.billDate),
        val:      Number(bill.grandTotal),
        pos,
        rchrg:    'N',
        inv_typ:  'R',
        pre_gst:  'N',
        itms,
      };

      const list = cdnrByGstin.get(bill.customerGstin!) ?? [];
      list.push(nt);
      cdnrByGstin.set(bill.customerGstin!, list);
    }

    const cdnr = [...cdnrByGstin.entries()].map(([ctin, nt]) => ({ ctin, nt }));

    // ── cdnur: Credit notes for B2C Large (inter-state, cross-period voids) ────
    // B2C Small cross-period voids (intra-state OR val ≤ ₹2.5L) are netted off b2cs below.
    const b2cSmallVoidDeductMap = new Map<string, { txval: number; camt: number; samt: number; iamt: number; csamt: number }>();

    const cdnur = crossVoidBills
      .filter((b) => {
        if (b.customerGstin) return false; // B2B → cdnr, not cdnur
        const pos = b.supplyStateCode ?? bizState;
        return pos !== bizState && Number(b.grandTotal) > B2CL_THRESHOLD; // inter-state + large only
      })
      .map((bill) => {
        const pos     = bill.supplyStateCode ?? bizState;
        const rateMap = new Map<number, { txval: number; iamt: number; csamt: number }>();
        for (const item of bill.items) {
          const rt  = Number(item.gstRatePercent);
          const cur = rateMap.get(rt) ?? { txval: 0, iamt: 0, csamt: 0 };
          rateMap.set(rt, {
            txval: r2(cur.txval + Number(item.taxableAmount)),
            iamt:  r2(cur.iamt  + Number(item.igstAmount)),  // inter-state — IGST only
            csamt: r2(cur.csamt + Number(item.cessAmount)),
          });
        }
        return {
          ntty:    'C',
          nt_num:  `CN/${(bill.billNumber ?? 'VOID').slice(0, 13)}`,
          nt_dt:   fmtDate(bill.voidedAt ?? bill.billDate),
          typ:     'OE',
          val:     Number(bill.grandTotal),
          pos,
          pre_gst: 'N',
          itms:    [...rateMap.entries()].map(([rt, v], idx) => ({
            num: idx + 1, itm_det: { rt, txval: v.txval, iamt: v.iamt, csamt: v.csamt },
          })),
        };
      });

    // Collect B2C small cross-period voids for b2cs net-off
    for (const bill of crossVoidBills) {
      if (bill.customerGstin) continue;
      const pos = bill.supplyStateCode ?? bizState;
      const isInter = pos !== bizState;
      if (isInter && Number(bill.grandTotal) > B2CL_THRESHOLD) continue; // already in cdnur
      const splyTp = isInter ? 'INTER' : 'INTRA';
      for (const item of bill.items) {
        const rt  = Number(item.gstRatePercent);
        const key = `${splyTp}__${pos}__${rt}`;
        const cur = b2cSmallVoidDeductMap.get(key) ?? { txval: 0, camt: 0, samt: 0, iamt: 0, csamt: 0 };
        b2cSmallVoidDeductMap.set(key, {
          txval: r2(cur.txval + Number(item.taxableAmount)),
          camt:  r2(cur.camt  + Number(item.cgstAmount)),
          samt:  r2(cur.samt  + Number(item.sgstAmount)),
          iamt:  r2(cur.iamt  + Number(item.igstAmount)),
          csamt: r2(cur.csamt + Number(item.cessAmount)),
        });
      }
    }

    // ── hsn (Table 12) ───────────────────────────────────────────────────────
    // Excluded: non-numeric HSN codes (UNCLASSIFIED, SAC codes, empty) + rt=0 rows (go to nil table)
    const HSN_NUMERIC = /^\d{4,8}$/;
    const hsnForPortal = salesData.hsnSummary.filter(
      (h) => HSN_NUMERIC.test(h.hsnCode) && h.gstRate > 0,
    );
    const hsn = {
      data: hsnForPortal.map((h, idx) => ({
        num:    idx + 1,
        hsn_sc: h.hsnCode,
        desc:   (h.description ?? '').slice(0, 50),
        uqc:    h.uom,
        qty:    h.totalQty,
        rt:     h.gstRate,
        val:    r2(h.taxableAmount + h.cgst + h.sgst + h.igst + h.cess),
        txval:  h.taxableAmount,
        // Always emit all three heads — portal sums them; zero is fine for the missing head
        iamt:   h.igst,
        camt:   h.cgst,
        samt:   h.sgst,
        csamt:  h.cess,
      })),
    };

    // ── nil (Table 8) — populated from rt=0 HSN items ───────────────────────
    // Zero-rate items are excluded from HSN table (above) and must appear here instead.
    const zeroRateHsn = salesData.hsnSummary.filter((h) => h.gstRate === 0);
    const nilAmts = { intrB2B: 0, intrB2C: 0, intraB2B: 0, intraB2C: 0 };
    for (const h of zeroRateHsn) {
      // Classify by IGST presence (inter-state) and whether it appears in B2B sales data
      const isInter = h.igst > 0 || (h.cgst === 0 && h.sgst === 0 && h.igst === 0);
      // Use taxableAmount as the exempt supply amount
      const amt = h.taxableAmount;
      // Approximate split: if any IGST was recorded it was inter-state, else intra
      if (h.igst > 0) {
        nilAmts.intrB2B  = r2(nilAmts.intrB2B  + amt); // simplified: all inter as B2B
      } else {
        nilAmts.intraB2C = r2(nilAmts.intraB2C + amt); // simplified: all intra as B2C
      }
    }
    const nil = {
      inv: [
        { sply_tp: 'INTRB2B',  nil_amt: 0, expt_amt: nilAmts.intrB2B,  ngsup_amt: 0 },
        { sply_tp: 'INTRB2C',  nil_amt: 0, expt_amt: nilAmts.intrB2C,  ngsup_amt: 0 },
        { sply_tp: 'INTRAB2B', nil_amt: 0, expt_amt: nilAmts.intraB2B, ngsup_amt: 0 },
        { sply_tp: 'INTRAB2C', nil_amt: 0, expt_amt: nilAmts.intraB2C, ngsup_amt: 0 },
      ],
    };

    // ── doc_issue (Table 13) ─────────────────────────────────────────────────
    const issued    = periodBills.filter((b) => b.billNumber);
    const cancelled = periodBills.filter((b) => b.isVoided && b.billNumber);
    // Numeric sort: extract trailing digits so INV-9 sorts before INV-10
    const numSuffix = (s: string) => { const m = s.match(/(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
    const sorted    = issued.map((b) => b.billNumber!).sort((a, b) => numSuffix(a) - numSuffix(b));

    const doc_issue = {
      doc_det: [{
        doc_num: 1,
        docs: sorted.length > 0
          ? [{
              num:       1,
              from:      sorted[0],
              to:        sorted[sorted.length - 1],
              totnum:    issued.length,
              cancel:    cancelled.length,
              net_issue: issued.length - cancelled.length,
            }]
          : [],
      }],
    };

    // ── Apply B2C small cross-period void deductions to b2cs ─────────────────
    const b2csFinal = b2cs.map((entry) => {
      const key = `${entry.sply_tp}__${entry.pos}__${entry.rt}`;
      const ded = b2cSmallVoidDeductMap.get(key);
      if (!ded) return entry;
      b2cSmallVoidDeductMap.delete(key);
      const e = entry as any;
      return {
        ...entry,
        txval: r2(entry.txval - ded.txval),
        ...(entry.sply_tp === 'INTRA'
          ? { camt: r2((e.camt ?? 0) - ded.camt), samt: r2((e.samt ?? 0) - ded.samt) }
          : { iamt: r2((e.iamt ?? 0) - ded.iamt) }),
        csamt: r2(entry.csamt - ded.csamt),
      };
    });
    // Any remaining deductions have no matching current-period sales entry → standalone negative
    for (const [key, ded] of b2cSmallVoidDeductMap) {
      const [splyTp, pos, rtStr] = key.split('__');
      b2csFinal.push({
        sply_tp: splyTp, pos, typ: 'OE', rt: Number(rtStr),
        txval: -ded.txval,
        ...(splyTp === 'INTRA' ? { camt: -ded.camt, samt: -ded.samt } : { iamt: -ded.iamt }),
        csamt: -ded.csamt,
      } as any);
    }

    // ── Grand total for portal header fields ─────────────────────────────────
    const curGt = r2(
      salesData.b2b.reduce((s, b) => s + b.grandTotal, 0) +
      salesData.b2cl.reduce((s, g) => s + g.invoices.reduce((s2, inv) => s2 + inv.val, 0), 0) +
      salesData.b2cs.reduce((s, b) => s + r2(b.taxableAmount + b.cgst + b.sgst + b.igst + b.cess), 0),
    );

    // ── Metadata for UI (not part of the portal upload) ──────────────────────
    const excludedHsnCount = salesData.hsnSummary.filter(
      (h) => !HSN_NUMERIC.test(h.hsnCode) || h.gstRate === 0,
    ).length;
    const _meta = {
      unclassifiedHsnCount: excludedHsnCount,
      creditNoteCount:      cdnr.reduce((s, c) => s + c.nt.length, 0) + cdnur.length,
      b2cSmallCreditNotes:  [...new Map(b2cSmallVoidDeductMap).entries()].length === 0
        ? crossVoidBills.filter((b) => {
            if (b.customerGstin) return false;
            const p = b.supplyStateCode ?? bizState;
            return !(p !== bizState && Number(b.grandTotal) > B2CL_THRESHOLD);
          }).length
        : 0,
    };

    return {
      version: GSTR1_VERSION,
      hash:    'hash',
      gstin:   biz.gstin,
      fp,
      gt:      curGt,
      cur_gt:  curGt,
      b2b,
      b2cl,
      b2cs:    b2csFinal.filter((e) => e.txval !== 0),
      ...(cdnr.length  > 0 ? { cdnr  } : {}),
      ...(cdnur.length > 0 ? { cdnur } : {}),
      hsn,
      nil,
      doc_issue,
      _meta,
    };
  }
}
