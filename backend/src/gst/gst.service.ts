import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { RuleEngineService } from '../platform/rule-engine/rule-engine.service';

export interface GstLineItem {
  taxableAmount: Decimal | number;
  gstSlab: '0' | '5' | '12' | '18' | '28' | 'EXEMPT' | 'ZERO';
  supplyType: 'B2B' | 'B2C' | 'EXPORT' | 'EXEMPT';
  partyGstin?: string;
  isInterState?: boolean;
  invoiceId?: string;
  invoiceNo?: string;
  invoiceDate?: Date;
}

export interface GstComputationResult {
  taxPeriod: string;
  gstr1: {
    b2bTaxable: number;
    b2bTax: number;
    b2cTaxable: number;
    b2cTax: number;
    exportTaxable: number;
    nilExempt: number;
    totalTax: number;
  };
  gstr3b: {
    totalLiability: number;
    itcCgst: number;
    itcSgst: number;
    itcIgst: number;
    netPayableCgst: number;
    netPayableSgst: number;
    netPayableIgst: number;
    netTotal: number;
  };
  returnId: string;
}

@Injectable()
export class GstService {
  private readonly logger = new Logger(GstService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ruleEngine: RuleEngineService,
  ) {}

  validateGstin(gstin: string): { valid: boolean; message?: string } {
    const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!pattern.test(gstin.toUpperCase())) {
      return {
        valid: false,
        message: 'Invalid GSTIN format. Must match: 2-digit state + 10-char PAN + 1 + Z + check.',
      };
    }
    return { valid: true };
  }

  async computeRate(
    businessId: string,
    gstSlab: string,
    isInterState: boolean,
  ): Promise<{ cgst: number; sgst: number; igst: number }> {
    try {
      const result = await this.ruleEngine.evaluate({
        businessId,
        ruleSetCode: 'GST_RATE_STANDARD',
        inputs: { gstSlab },
      });
      const out = result.output as { cgst?: number; sgst?: number; igst?: number };
      if (isInterState) return { cgst: 0, sgst: 0, igst: out.igst ?? 0 };
      return { cgst: out.cgst ?? 0, sgst: out.sgst ?? 0, igst: 0 };
    } catch {
      // Fallback: derive from slab label if rule engine has no GST_RATE_STANDARD set
      const rate = Number(gstSlab) / 100;
      if (isNaN(rate)) return { cgst: 0, sgst: 0, igst: 0 };
      if (isInterState) return { cgst: 0, sgst: 0, igst: rate };
      return { cgst: rate / 2, sgst: rate / 2, igst: 0 };
    }
  }

  async compute(businessId: string, taxPeriod: string): Promise<GstComputationResult> {
    const [year, month] = taxPeriod.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12)
      throw new BadRequestException('taxPeriod must be YYYY-MM');

    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);
    const financialYear =
      month >= 4
        ? `${year}-${String(year + 1).slice(2)}`
        : `${year - 1}-${String(year).slice(2)}`;

    const salesItems = await this.fetchSalesItems(businessId, periodStart, periodEnd);
    const purchaseItems = await this.fetchPurchaseItems(businessId, periodStart, periodEnd);

    let b2bTaxable = 0,
      b2bTax = 0;
    let b2cTaxable = 0,
      b2cTax = 0;
    let exportTaxable = 0;
    let nilExempt = 0;

    for (const item of salesItems) {
      const taxable = Number(item.taxableAmount);
      const rates = await this.computeRate(businessId, item.gstSlab, item.isInterState ?? false);
      const tax = taxable * (rates.cgst + rates.sgst + rates.igst);

      if (item.gstSlab === 'EXEMPT' || item.gstSlab === 'ZERO' || item.gstSlab === '0') {
        nilExempt += taxable;
      } else if (item.supplyType === 'EXPORT') {
        exportTaxable += taxable;
      } else if (item.supplyType === 'B2B') {
        b2bTaxable += taxable;
        b2bTax += tax;
      } else {
        b2cTaxable += taxable;
        b2cTax += tax;
      }
    }

    const gstr1 = {
      b2bTaxable: round4(b2bTaxable),
      b2bTax: round4(b2bTax),
      b2cTaxable: round4(b2cTaxable),
      b2cTax: round4(b2cTax),
      exportTaxable: round4(exportTaxable),
      nilExempt: round4(nilExempt),
      totalTax: round4(b2bTax + b2cTax),
    };

    let itcCgst = 0,
      itcSgst = 0,
      itcIgst = 0;

    for (const item of purchaseItems) {
      const taxable = Number(item.taxableAmount);
      const rates = await this.computeRate(businessId, item.gstSlab, item.isInterState ?? false);
      itcCgst += taxable * rates.cgst;
      itcSgst += taxable * rates.sgst;
      itcIgst += taxable * rates.igst;
    }

    const manualItc = await this.prisma.itcLedger.findMany({
      where: { businessId, taxPeriod, isReversed: false },
    });
    for (const itc of manualItc) {
      itcCgst += Number(itc.cgst);
      itcSgst += Number(itc.sgst);
      itcIgst += Number(itc.igst);
    }

    const halfTax = gstr1.totalTax / 2;
    const gstr3b = {
      totalLiability: round4(gstr1.totalTax),
      itcCgst: round4(itcCgst),
      itcSgst: round4(itcSgst),
      itcIgst: round4(itcIgst),
      netPayableCgst: round4(Math.max(0, halfTax - itcCgst)),
      netPayableSgst: round4(Math.max(0, halfTax - itcSgst)),
      netPayableIgst: round4(Math.max(0, -itcIgst)),
      netTotal: 0,
    };
    gstr3b.netTotal = round4(
      gstr3b.netPayableCgst + gstr3b.netPayableSgst + gstr3b.netPayableIgst,
    );

    const gstr1Return = await this.prisma.gstReturn.upsert({
      where: {
        businessId_returnType_taxPeriod: { businessId, returnType: 'GSTR1', taxPeriod },
      },
      create: {
        businessId,
        returnType: 'GSTR1',
        taxPeriod,
        financialYear,
        status: 'COMPUTED',
        b2bTaxable: new Decimal(gstr1.b2bTaxable),
        b2bTax: new Decimal(gstr1.b2bTax),
        b2cTaxable: new Decimal(gstr1.b2cTaxable),
        b2cTax: new Decimal(gstr1.b2cTax),
        exportTaxable: new Decimal(gstr1.exportTaxable),
        nilExempt: new Decimal(gstr1.nilExempt),
        totalLiability: new Decimal(gstr1.totalTax),
      },
      update: {
        status: 'COMPUTED',
        b2bTaxable: new Decimal(gstr1.b2bTaxable),
        b2bTax: new Decimal(gstr1.b2bTax),
        b2cTaxable: new Decimal(gstr1.b2cTaxable),
        b2cTax: new Decimal(gstr1.b2cTax),
        exportTaxable: new Decimal(gstr1.exportTaxable),
        nilExempt: new Decimal(gstr1.nilExempt),
        totalLiability: new Decimal(gstr1.totalTax),
      },
    });

    await this.prisma.gstReturn.upsert({
      where: {
        businessId_returnType_taxPeriod: { businessId, returnType: 'GSTR3B', taxPeriod },
      },
      create: {
        businessId,
        returnType: 'GSTR3B',
        taxPeriod,
        financialYear,
        status: 'COMPUTED',
        totalLiability: new Decimal(gstr3b.totalLiability),
        itcCgst: new Decimal(gstr3b.itcCgst),
        itcSgst: new Decimal(gstr3b.itcSgst),
        itcIgst: new Decimal(gstr3b.itcIgst),
        netPayableCgst: new Decimal(gstr3b.netPayableCgst),
        netPayableSgst: new Decimal(gstr3b.netPayableSgst),
        netPayableIgst: new Decimal(gstr3b.netPayableIgst),
      },
      update: {
        status: 'COMPUTED',
        totalLiability: new Decimal(gstr3b.totalLiability),
        itcCgst: new Decimal(gstr3b.itcCgst),
        itcSgst: new Decimal(gstr3b.itcSgst),
        itcIgst: new Decimal(gstr3b.itcIgst),
        netPayableCgst: new Decimal(gstr3b.netPayableCgst),
        netPayableSgst: new Decimal(gstr3b.netPayableSgst),
        netPayableIgst: new Decimal(gstr3b.netPayableIgst),
      },
    });

    this.logger.log(
      `GST computed ${businessId} ${taxPeriod}: liability ₹${gstr1.totalTax} ITC ₹${round4(itcCgst + itcSgst + itcIgst)}`,
    );

    return { taxPeriod, gstr1, gstr3b, returnId: gstr1Return.id };
  }

  async getReturn(id: string) {
    const r = await this.prisma.gstReturn.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('GST return not found');
    return r;
  }

  async listReturns(businessId: string) {
    return this.prisma.gstReturn.findMany({
      where: { businessId },
      orderBy: [{ taxPeriod: 'desc' }, { returnType: 'asc' }],
    });
  }

  async markFiled(id: string) {
    const r = await this.prisma.gstReturn.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('GST return not found');
    if (r.status !== 'COMPUTED')
      throw new BadRequestException('Only COMPUTED returns can be marked as filed');
    return this.prisma.gstReturn.update({
      where: { id },
      data: { status: 'FILED', filedAt: new Date() },
    });
  }

  async getItcLedger(businessId: string, taxPeriod?: string) {
    return this.prisma.itcLedger.findMany({
      where: { businessId, ...(taxPeriod ? { taxPeriod } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addItcEntry(
    businessId: string,
    taxPeriod: string,
    sourceType: string,
    sourceId: string,
    cgst: number,
    sgst: number,
    igst: number,
  ) {
    return this.prisma.itcLedger.create({
      data: {
        businessId,
        taxPeriod,
        sourceType,
        sourceId,
        cgst: new Decimal(cgst),
        sgst: new Decimal(sgst),
        igst: new Decimal(igst),
      },
    });
  }

  async recordChallan(
    businessId: string,
    taxPeriod: string,
    data: {
      cgstPaid: number;
      sgstPaid: number;
      igstPaid: number;
      interest?: number;
      lateFee?: number;
      cpin?: string;
      bsrCode?: string;
      paidAt?: Date;
    },
  ) {
    const totalPaid =
      data.cgstPaid +
      data.sgstPaid +
      data.igstPaid +
      (data.interest ?? 0) +
      (data.lateFee ?? 0);
    return this.prisma.gstChallan.create({
      data: {
        businessId,
        taxPeriod,
        cgstPaid: new Decimal(data.cgstPaid),
        sgstPaid: new Decimal(data.sgstPaid),
        igstPaid: new Decimal(data.igstPaid),
        interest: new Decimal(data.interest ?? 0),
        lateFee: new Decimal(data.lateFee ?? 0),
        totalPaid: new Decimal(totalPaid),
        cpin: data.cpin,
        bsrCode: data.bsrCode,
        paidAt: data.paidAt ?? new Date(),
      },
    });
  }

  async listChallans(businessId: string) {
    return this.prisma.gstChallan.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSummary(businessId: string) {
    const returns = await this.prisma.gstReturn.findMany({
      where: { businessId },
      orderBy: { taxPeriod: 'desc' },
      take: 12,
    });
    const challans = await this.prisma.gstChallan.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const pendingFiling = returns.filter((r) => r.status === 'COMPUTED').length;
    const totalPaid = challans.reduce((s, c) => s + Number(c.totalPaid), 0);
    return { returns, challans, pendingFiling, totalPaid };
  }

  exportGstr1Json(r: Awaited<ReturnType<typeof this.getReturn>>) {
    return {
      gstin: null,
      ret_period: r.taxPeriod.replace('-', ''),
      b2b: [],
      b2cl: [],
      exp: [],
      nil: {
        sply_ty: 'INTRB2B',
        expt_amt: 0,
        nil_amt: Number(r.nilExempt),
        ngsup_amt: 0,
      },
      hsn: { data: [] },
      doc_issue: {},
      _meta: {
        generated: new Date().toISOString(),
        note: 'B2B invoice detail will be added in Phase 2',
      },
    };
  }

  private async fetchSalesItems(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<GstLineItem[]> {
    try {
      const bills =
        (await (this.prisma as any).salesBill?.findMany?.({
          where: { businessId, createdAt: { gte: from, lte: to } },
          include: { items: { include: { tax: true } } },
        })) ?? [];

      return bills.flatMap((bill: any) =>
        (bill.items ?? []).map(
          (item: any): GstLineItem => ({
            taxableAmount: Number(item.price ?? 0) * Number(item.quantity ?? 0),
            gstSlab: this.taxRateToSlab(Number(item.tax?.taxRate ?? 0)),
            supplyType: bill.partyGstin ? 'B2B' : 'B2C',
            partyGstin: bill.partyGstin,
            isInterState: false,
            invoiceId: bill.id,
            invoiceNo: bill.billNumber,
            invoiceDate: bill.createdAt,
          }),
        ),
      );
    } catch {
      return [];
    }
  }

  private async fetchPurchaseItems(
    businessId: string,
    from: Date,
    to: Date,
  ): Promise<GstLineItem[]> {
    try {
      const bills =
        (await (this.prisma as any).purchaseBill?.findMany?.({
          where: { businessId, createdAt: { gte: from, lte: to } },
          include: { items: { include: { tax: true } } },
        })) ?? [];

      return bills.flatMap((bill: any) =>
        (bill.items ?? []).map(
          (item: any): GstLineItem => ({
            taxableAmount: Number(item.price ?? 0) * Number(item.quantity ?? 0),
            gstSlab: this.taxRateToSlab(Number(item.tax?.taxRate ?? 0)),
            supplyType: 'B2B',
            isInterState: false,
          }),
        ),
      );
    } catch {
      return [];
    }
  }

  private taxRateToSlab(rate: number): GstLineItem['gstSlab'] {
    if (rate === 0) return 'EXEMPT';
    if (rate <= 5) return '5';
    if (rate <= 12) return '12';
    if (rate <= 18) return '18';
    return '28';
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
