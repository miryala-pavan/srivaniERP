import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export interface GstIssue {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  count?: number;
  actionUrl: string;
  actionLabel: string;
  blocksFilingI: boolean;
}

export interface GstHealthReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  checkedAt: string;
  critical: GstIssue[];
  high: GstIssue[];
  medium: GstIssue[];
  low: GstIssue[];
  totalIssues: number;
  isFilingReady: boolean;
  summary: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number };
}

@Injectable()
export class GstHealthService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async runHealthChecks(businessId: string): Promise<GstHealthReport> {
    const now       = new Date();
    const days30    = new Date(now.getTime() - 30 * 86_400_000);
    const days90    = new Date(now.getTime() - 90 * 86_400_000);
    const days180   = new Date(now.getTime() - 180 * 86_400_000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [
      business,
      hsnZeroCount,
      dupRows,
      itcRiskRows,
      noGstinGrnCount,
      allSuppliers,
      b2bNoGstinCount,
      voidedCount,
      totalBillCount,
      thisMonthAgg,
      lastMonthAgg,
      productsNoHsnCount,
      payable90Rows,
      roundRows,
    ] = await Promise.all([
      this.prisma.business.findUnique({
        where:  { id: businessId },
        select: { gstin: true, stateCode: true },
      }),

      // C2 — items sold in last 30 days with no/placeholder HSN
      this.prisma.salesItem.count({
        where: {
          bill: { businessId, billDate: { gte: days30 }, status: 'FINAL' as any, isVoided: false },
          OR: [{ hsnCode: null }, { hsnCode: '' }, { hsnCode: '0000' }],
        },
      }),

      // C3 — duplicate bill numbers (FINAL, non-voided)
      this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*)::bigint AS cnt FROM (
          SELECT "billNumber" FROM sales_bill
          WHERE "businessId" = ${businessId}::uuid
            AND status = 'FINAL' AND "isVoided" = false
          GROUP BY "billNumber" HAVING COUNT(*) > 1
        ) d
      `,

      // C4 — GRNs > 180 days old, supplier GSTIN present, still has unpaid balance
      this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*)::bigint AS cnt FROM purchase
        WHERE "businessId" = ${businessId}::uuid
          AND status = 'APPROVED'
          AND "invoiceDate" <= ${days180}
          AND "supplierGstin" IS NOT NULL AND "supplierGstin" != ''
          AND COALESCE("paidAmount", 0) < "grandTotal"
      `,

      // H1 — approved GRNs with no supplier GSTIN
      this.prisma.purchase.count({
        where: {
          businessId,
          status: 'APPROVED' as any,
          OR: [{ supplierGstin: null }, { supplierGstin: '' }],
        },
      }),

      // H2 — suppliers that have a GSTIN set (for format check in code)
      this.prisma.supplier.findMany({
        where:  { businessId, gstin: { not: null } },
        select: { gstin: true, name: true },
      }),

      // H3 — B2B bills with no customer GSTIN in last 30 days
      this.prisma.salesBill.count({
        where: {
          businessId,
          isB2B:    true,
          billDate: { gte: days30 },
          status:   'FINAL' as any,
          isVoided: false,
          OR: [{ customerGstin: null }, { customerGstin: '' }],
        },
      }),

      // M1a — voided bills in last 30 days
      this.prisma.salesBill.count({
        where: {
          businessId,
          isVoided: true,
          voidedAt: { gte: days30 },
          status:   'FINAL' as any,
        },
      }),

      // M1b — total non-voided FINAL bills in last 30 days
      this.prisma.salesBill.count({
        where: {
          businessId,
          billDate: { gte: days30 },
          status:   'FINAL' as any,
          isVoided: false,
        },
      }),

      // M2a — this month's purchase total
      this.prisma.purchase.aggregate({
        where: { businessId, status: 'APPROVED' as any, invoiceDate: { gte: monthStart } },
        _sum:  { grandTotal: true },
      }),

      // M2b — last month's purchase total
      this.prisma.purchase.aggregate({
        where: { businessId, status: 'APPROVED' as any, invoiceDate: { gte: prevStart, lte: prevEnd } },
        _sum:  { grandTotal: true },
      }),

      // M3 — active products with no valid HSN
      this.prisma.product.count({
        where: {
          businessId,
          isActive: true,
          OR: [{ hsnCode: '' }, { hsnCode: '0000' }],
        },
      }),

      // M4 — GRNs > 90 days old, still partially unpaid
      this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*)::bigint AS cnt FROM purchase
        WHERE "businessId" = ${businessId}::uuid
          AND status = 'APPROVED'
          AND "invoiceDate" <= ${days90}
          AND COALESCE("paidAmount", 0) < "grandTotal"
      `,

      // L1 — bills in last 30 days with round-figure totals (divisible by 1000, ≥ ₹5000)
      this.prisma.$queryRaw<Array<{ cnt: bigint }>>`
        SELECT COUNT(*)::bigint AS cnt FROM sales_bill
        WHERE "businessId" = ${businessId}::uuid
          AND "isVoided" = false AND status = 'FINAL'
          AND "billDate" >= ${days30}
          AND "grandTotal" >= 5000
          AND "grandTotal" % 1000 = 0
      `,
    ]);

    const issues: GstIssue[] = [];

    // ── CRITICAL ──────────────────────────────────────────────────────────────

    if (!business?.gstin) {
      issues.push({
        id: 'C1', severity: 'CRITICAL', blocksFilingI: true,
        title: 'Business GSTIN is not set',
        description: 'GSTR-1 and GSTR-3B cannot be filed without a valid GSTIN. Add your GSTIN in Business Settings immediately.',
        actionUrl: '/dashboard/business', actionLabel: 'Open Business Settings',
      });
    } else if (!GSTIN_REGEX.test(business.gstin)) {
      issues.push({
        id: 'C1', severity: 'CRITICAL', blocksFilingI: true,
        title: `Business GSTIN '${business.gstin}' has invalid format`,
        description: 'A GSTIN must be 15 characters: 2-digit state code + 10-char PAN + entity + Z + check digit. Fix it in Business Settings.',
        actionUrl: '/dashboard/business', actionLabel: 'Fix GSTIN',
      });
    }

    if (hsnZeroCount > 0) {
      issues.push({
        id: 'C2', severity: 'CRITICAL', blocksFilingI: true, count: hsnZeroCount,
        title: `${hsnZeroCount} sales items in last 30 days have missing or placeholder HSN codes`,
        description: 'Items with HSN "0000" or blank will fail HSN validation in GSTR-1. Assign correct HSN codes to these products before filing.',
        actionUrl: '/dashboard/plu', actionLabel: 'Fix HSN in PLU',
      });
    }

    const dupCount = Number((dupRows[0] as any)?.cnt ?? 0);
    if (dupCount > 0) {
      issues.push({
        id: 'C3', severity: 'CRITICAL', blocksFilingI: true, count: dupCount,
        title: `${dupCount} duplicate invoice number(s) detected in sales`,
        description: 'Duplicate invoice numbers are rejected by the GST portal and can trigger a compliance notice. Verify and correct invoice numbering.',
        actionUrl: '/dashboard/bills', actionLabel: 'View Bills',
      });
    }

    const itcRiskCount = Number((itcRiskRows[0] as any)?.cnt ?? 0);
    if (itcRiskCount > 0) {
      issues.push({
        id: 'C4', severity: 'CRITICAL', blocksFilingI: false, count: itcRiskCount,
        title: `${itcRiskCount} GRN(s) older than 180 days have unpaid balances — ITC reversal required`,
        description: 'Under Section 16(2)(b) CGST Act, ITC must be reversed if the supplier invoice is not paid within 180 days. Record payments or reverse ITC now to avoid penalty + interest.',
        actionUrl: '/dashboard/grn', actionLabel: 'View GRNs',
      });
    }

    // ── HIGH ──────────────────────────────────────────────────────────────────

    if (noGstinGrnCount > 0) {
      issues.push({
        id: 'H1', severity: 'HIGH', blocksFilingI: false, count: noGstinGrnCount,
        title: `${noGstinGrnCount} approved GRN(s) have no supplier GSTIN — ITC may be disallowed`,
        description: 'ITC cannot be claimed on purchases from unregistered suppliers. If the supplier is GST-registered, enter their GSTIN in supplier master immediately — existing GRNs will be auto-updated.',
        actionUrl: '/dashboard/suppliers', actionLabel: 'Update Suppliers',
      });
    }

    const invalidSuppliers = (allSuppliers as Array<{ gstin: string | null; name: string }>)
      .filter(s => s.gstin && !GSTIN_REGEX.test(s.gstin));
    if (invalidSuppliers.length > 0) {
      const names = invalidSuppliers.slice(0, 3).map(s => s.name).join(', ');
      issues.push({
        id: 'H2', severity: 'HIGH', blocksFilingI: false, count: invalidSuppliers.length,
        title: `${invalidSuppliers.length} supplier(s) have invalid GSTIN format`,
        description: `Suppliers with invalid GSTINs: ${names}${invalidSuppliers.length > 3 ? ' and others' : ''}. ITC claimed on their GRNs may be disallowed during audit.`,
        actionUrl: '/dashboard/suppliers', actionLabel: 'Fix Supplier GSTINs',
      });
    }

    if (b2bNoGstinCount > 0) {
      issues.push({
        id: 'H3', severity: 'HIGH', blocksFilingI: false, count: b2bNoGstinCount,
        title: `${b2bNoGstinCount} B2B bill(s) in last 30 days are missing customer GSTIN`,
        description: 'Bills marked as B2B without a customer GSTIN will be reported as B2C in GSTR-1, causing a mismatch with the buyer\'s purchase register and potential scrutiny.',
        actionUrl: '/dashboard/bills', actionLabel: 'Fix Bills',
      });
    }

    // ── MEDIUM ────────────────────────────────────────────────────────────────

    const voidRate = totalBillCount > 0 ? (voidedCount / totalBillCount) * 100 : 0;
    if (voidRate > 5) {
      issues.push({
        id: 'M1', severity: 'MEDIUM', blocksFilingI: false, count: voidedCount,
        title: `High cancellation rate: ${voidRate.toFixed(1)}% of last 30 days' bills were voided`,
        description: 'Cancellation rates above 5% are a GST risk indicator. Excessive cancellations can attract departmental scrutiny. Ensure each voided bill has a valid business reason.',
        actionUrl: '/dashboard/bills', actionLabel: 'Review Voided Bills',
      });
    }

    const thisMonth = Number(thisMonthAgg._sum.grandTotal ?? 0);
    const lastMonth = Number(lastMonthAgg._sum.grandTotal ?? 0);
    if (lastMonth > 0 && thisMonth > lastMonth * 1.5) {
      const pct = Math.round((thisMonth - lastMonth) / lastMonth * 100);
      issues.push({
        id: 'M2', severity: 'MEDIUM', blocksFilingI: false,
        title: `Purchase volume this month is ${pct}% higher than last month`,
        description: `This month: ₹${(thisMonth / 1000).toFixed(0)}K vs last month: ₹${(lastMonth / 1000).toFixed(0)}K. Sudden spikes in purchase volume can trigger GST scrutiny. Verify all GRNs are genuine.`,
        actionUrl: '/dashboard/grn', actionLabel: 'Review GRNs',
      });
    }

    if (productsNoHsnCount > 0) {
      issues.push({
        id: 'M3', severity: 'MEDIUM', blocksFilingI: false, count: productsNoHsnCount,
        title: `${productsNoHsnCount} active product(s) have no valid HSN code in the catalog`,
        description: 'Products without HSN codes cannot be correctly reported in GSTR-1 HSN summary. Bulk-assign HSN codes before the next filing date.',
        actionUrl: '/dashboard/plu', actionLabel: 'Assign HSN Codes',
      });
    }

    const payable90Count = Number((payable90Rows[0] as any)?.cnt ?? 0);
    if (payable90Count > 0) {
      issues.push({
        id: 'M4', severity: 'MEDIUM', blocksFilingI: false, count: payable90Count,
        title: `${payable90Count} GRN(s) have outstanding payments older than 90 days`,
        description: 'Unpaid supplier invoices approaching 180 days will require ITC reversal. Record payments now via Supplier Payments to protect your ITC.',
        actionUrl: '/dashboard/payments', actionLabel: 'Record Payments',
      });
    }

    // ── LOW ───────────────────────────────────────────────────────────────────

    const roundCount = Number((roundRows[0] as any)?.cnt ?? 0);
    if (roundCount >= 5) {
      issues.push({
        id: 'L1', severity: 'LOW', blocksFilingI: false, count: roundCount,
        title: `${roundCount} bills in last 30 days have round-figure totals (multiples of ₹1,000)`,
        description: 'A high count of round-figure invoice amounts is a common GST audit risk flag. Verify these bills represent genuine transactions with correct item-level billing.',
        actionUrl: '/dashboard/bills', actionLabel: 'Review Bills',
      });
    }

    // ── Score ─────────────────────────────────────────────────────────────────

    const critical = issues.filter(i => i.severity === 'CRITICAL');
    const high     = issues.filter(i => i.severity === 'HIGH');
    const medium   = issues.filter(i => i.severity === 'MEDIUM');
    const low      = issues.filter(i => i.severity === 'LOW');

    let score = 100;
    score -= critical.length * 20;
    score -= high.length     * 10;
    score -= medium.length   * 5;
    score -= low.length      * 2;
    score = Math.max(0, score);

    const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

    return {
      score, grade,
      checkedAt:    now.toISOString(),
      critical, high, medium, low,
      totalIssues:  issues.length,
      isFilingReady: critical.length === 0,
      summary: {
        criticalCount: critical.length,
        highCount:     high.length,
        mediumCount:   medium.length,
        lowCount:      low.length,
      },
    };
  }

  async runAndNotify(businessId: string): Promise<GstHealthReport> {
    const report = await this.runHealthChecks(businessId);
    const since  = new Date(Date.now() - 24 * 3_600_000);

    const alertIssues = [...report.critical, ...report.high];
    for (const issue of alertIssues) {
      const existing = await this.prisma.notification.findFirst({
        where: { businessId, title: issue.title, createdAt: { gte: since } },
        select: { id: true },
      });
      if (!existing) {
        await this.notifications.create({
          businessId,
          type:        issue.severity === 'CRITICAL' ? 'GST_CRITICAL' : 'GST_HIGH',
          priority:    issue.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
          title:       issue.title,
          message:     issue.description,
          actionUrl:   issue.actionUrl,
          actionLabel: issue.actionLabel,
        });
      }
    }

    return report;
  }
}
