import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCounterDto } from './dto/create-counter.dto';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { CreateBillDto, PaymentModeEnum } from './dto/create-bill.dto';
import { BillQueryDto } from './dto/bill-query.dto';
import { CreateHoldDto } from './dto/create-hold.dto';

// ─── Valid GST rates per Indian GST law ───────────────
const VALID_GST_RATES = new Set([0, 0.1, 0.25, 1.5, 3, 5, 6, 12, 18, 28]);

// ─── Helpers ──────────────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100;

function validateHsn(hsn: string) {
  if (!/^[0-9]+$/.test(hsn) || ![2, 4, 6, 8].includes(hsn.length)) {
    throw new BadRequestException(
      `HSN code "${hsn}" is invalid. Must be 2, 4, 6, or 8 numeric digits per GST rules.`,
    );
  }
}

function calculateItemGst(
  unitPrice: number,
  quantity: number,
  discountPercent: number,
  gstRate: number,
  isIntraState: boolean,
) {
  const baseAmount    = r2(unitPrice * quantity);
  const discountAmt   = r2(baseAmount * discountPercent / 100);
  const inclusive     = r2(baseAmount - discountAmt);        // amount customer pays
  const taxable       = r2(inclusive / (1 + gstRate / 100)); // base before tax
  const taxAmount     = r2(inclusive - taxable);

  let cgst = 0, sgst = 0, igst = 0;
  if (gstRate > 0) {
    if (isIntraState) {
      cgst = r2(taxAmount / 2);
      sgst = r2(taxAmount - cgst);  // handles ₹0.01 rounding remainder
    } else {
      igst = taxAmount;
    }
  }

  return { baseAmount, discountAmt, taxable, taxAmount, cgst, sgst, igst, totalAmount: inclusive };
}

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private products: ProductsService,
    private notifications: NotificationsService,
  ) {}

  // ─── COUNTER ──────────────────────────────────────────

  async createCounter(businessId: string, dto: CreateCounterDto) {
    // Resolve branch: explicit or first active branch
    const branchId = dto.branchId ?? await this.getFirstBranchId(businessId);

    const existing = await this.prisma.posCounter.findUnique({
      where: { businessId_code: { businessId, code: dto.code.toUpperCase() } },
    });
    if (existing) throw new ConflictException(`Counter code "${dto.code}" already exists`);

    return this.prisma.posCounter.create({
      data: {
        businessId,
        branchId,
        name: dto.name,
        code: dto.code.toUpperCase(),
        status: 'ACTIVE',
      },
      include: { branch: true },
    });
  }

  async getCounters(businessId: string) {
    return this.prisma.posCounter.findMany({
      where: { businessId },
      include: {
        branch: true,
        shifts: {
          where: { status: 'OPEN' },
          include: { cashier: { select: { id: true, fullName: true, username: true } } },
          take: 1,
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  // ─── SHIFT ────────────────────────────────────────────

  async openShift(businessId: string, userId: string, dto: OpenShiftDto) {
    const counter = await this.prisma.posCounter.findFirst({
      where: { id: dto.counterId, businessId },
    });
    if (!counter) throw new NotFoundException('Counter not found');
    if (counter.status !== 'ACTIVE') {
      throw new BadRequestException('Counter is not active');
    }

    // Check: cashier already has an open shift TODAY — resume it instead of erroring
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const existingShift = await this.prisma.posShift.findFirst({
      where: { cashierId: userId, status: 'OPEN', startTime: { gte: todayStart } },
      include: {
        counter: true,
        cashier: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });
    if (existingShift) {
      return { shift: existingShift, resumed: true };
    }

    const cashier = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });

    const newShift = await this.prisma.posShift.create({
      data: {
        counterId: dto.counterId,
        cashierId: userId,
        cashierName: cashier?.fullName ?? null,
        branchId: counter.branchId,
        openingCash: dto.openingCash,
        status: 'OPEN',
        startTime: new Date(),
      },
      include: {
        counter: true,
        cashier: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });
    return { shift: newShift, resumed: false };
  }

  async getMyShift(userId: string) {
    const shift = await this.prisma.posShift.findFirst({
      where: { cashierId: userId, status: 'OPEN' },
      include: {
        counter: true,
        cashier: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });
    return { shift: shift ?? null };
  }

  async getCurrentShift(userId: string, businessId: string) {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const shift = await this.prisma.posShift.findFirst({
      where: {
        cashierId: userId,
        status: 'OPEN',
        startTime: { gte: start },
        counter: { businessId },
      },
      include: {
        counter: true,
        cashier: { select: { id: true, fullName: true, username: true, role: true } },
      },
    });
    return { shift: shift ?? null };
  }

  async getTodayShifts(businessId: string, dateStr?: string) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end   = new Date(d); end.setHours(23, 59, 59, 999);

    return this.prisma.posShift.findMany({
      where: {
        counter: { businessId },
        startTime: { gte: start, lte: end },
      },
      include: {
        counter: { select: { id: true, name: true, code: true } },
        cashier: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async forceCloseShift(businessId: string, shiftId: string, managerName: string) {
    const shift = await this.prisma.posShift.findFirst({
      where: { id: shiftId, counter: { businessId }, status: 'OPEN' },
    });
    if (!shift) throw new NotFoundException('Open shift not found');

    const totalCash   = Number(shift.totalCash);
    const openingCash = Number(shift.openingCash);
    const expectedCash = r2(openingCash + totalCash);

    return this.prisma.posShift.update({
      where: { id: shiftId },
      data: {
        status:       'CLOSED',
        endTime:      new Date(),
        expectedCash,
        cashDiff:     r2(0 - expectedCash),
        notes:        `Force closed by manager: ${managerName}`,
      },
      include: {
        counter: { select: { id: true, name: true, code: true } },
        cashier: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  async closeShift(businessId: string, userId: string, shiftId: string, dto: CloseShiftDto) {
    const shift = await this.prisma.posShift.findFirst({
      where: { id: shiftId, cashierId: userId, status: 'OPEN' },
    });
    if (!shift) throw new NotFoundException('Open shift not found');

    const totalCash    = Number(shift.totalCash);
    const openingCash  = Number(shift.openingCash);
    const expectedCash = r2(openingCash + totalCash);
    const cashDiff     = r2(dto.closingCash - expectedCash);

    return this.prisma.posShift.update({
      where: { id: shiftId },
      data: {
        closingCash:  dto.closingCash,
        expectedCash,
        cashDiff,
        status:  'CLOSED',
        endTime: new Date(),
        notes:   dto.notes ?? null,
      },
      include: {
        counter: true,
        cashier: { select: { id: true, fullName: true, username: true } },
      },
    });
  }

  // ─── BILLING ──────────────────────────────────────────

  async createBill(businessId: string, userId: string, dto: CreateBillDto) {
    // ── 1. Load prerequisites ────────────────────────────
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    const counter = await this.prisma.posCounter.findFirst({
      where: { id: dto.counterId, businessId },
    });
    if (!counter) throw new NotFoundException('Counter not found');

    const shift = await this.prisma.posShift.findFirst({
      where: { id: dto.shiftId, status: 'OPEN' },
    });
    if (!shift) throw new NotFoundException('Shift not found or already closed');

    // Block billing if day not opened or already closed
    const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
    const dayRecord = await this.prisma.dayClosure.findFirst({
      where: { businessId, branchId: counter.branchId, closureDate: todayMidnight },
    });
    if (!dayRecord) {
      throw new BadRequestException('Day has not been opened yet. A manager must open the day before billing.');
    }
    if (dayRecord.status === 'COMPLETED') {
      throw new BadRequestException("Today's day is closed. Ask a manager to open a new day before billing.");
    }

    // Safety net: cashier must have an open shift today
    const cashierActiveShift = await this.prisma.posShift.findFirst({
      where: { cashierId: userId, status: 'OPEN', startTime: { gte: todayMidnight } },
    });
    if (!cashierActiveShift) {
      throw new BadRequestException('No active shift. Start a shift before billing.');
    }

    const fy = await this.prisma.financialYear.findFirst({
      where: { businessId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!fy) throw new BadRequestException('No active financial year. Complete business setup first.');

    const billType  = dto.billType ?? 'TAX_INVOICE';
    const billSeries = await this.prisma.billSeries.findFirst({
      where: { businessId, financialYearId: fy.id, billType, isActive: true },
    }) ?? await this.prisma.billSeries.findFirst({
      where: { businessId, financialYearId: fy.id, isActive: true },
    });
    if (!billSeries) throw new BadRequestException('No active bill series. Complete business setup first.');

    // ── 2. Determine intra/inter-state ───────────────────
    const businessState  = business.stateCode;  // '36' Telangana
    let   supplyState    = dto.supplyStateCode ?? businessState;
    if (dto.customerGstin && dto.customerGstin.length >= 2) {
      supplyState = dto.customerGstin.substring(0, 2);
    }
    const isIntraState = (supplyState === businessState);

    // ── 3. Resolve and validate each item ────────────────
    const productIds = dto.items.map((i) => i.productId);
    const taxIds     = dto.items.map((i) => i.taxId);

    const [products, taxes] = await Promise.all([
      this.prisma.product.findMany({ where: { id: { in: productIds }, businessId } }),
      this.prisma.tax.findMany({ where: { id: { in: taxIds }, businessId } }),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const taxMap     = new Map(taxes.map((t) => [t.id, t]));

    // Validate items and calculate GST
    const calcItems: Array<{
      dto: (typeof dto.items)[0];
      product: (typeof products)[0];
      tax: (typeof taxes)[0];
      calc: ReturnType<typeof calculateItemGst>;
    }> = [];

    for (const item of dto.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
      if (!product.isActive) throw new BadRequestException(`Product "${product.name}" is inactive`);

      const tax = taxMap.get(item.taxId);
      if (!tax) throw new NotFoundException(`Tax ${item.taxId} not found`);

      // Validate HSN per GST rules
      validateHsn(product.hsnCode);

      // Validate GST rate is standard
      const gstRate = Number(tax.taxRate);
      if (!VALID_GST_RATES.has(gstRate)) {
        throw new BadRequestException(
          `GST rate ${gstRate}% for "${product.name}" is not a valid Indian GST rate. ` +
          `Valid rates: ${[...VALID_GST_RATES].sort((a, b) => a - b).join(', ')}%`,
        );
      }

      const discountPercent = item.discountPercent ?? 0;
      const calc = calculateItemGst(item.unitPrice, item.quantity, discountPercent, gstRate, isIntraState);

      calcItems.push({ dto: item, product, tax, calc });
    }

    // ── 4. Aggregate bill totals ─────────────────────────
    let subtotal = 0, totalDiscount = 0, totalTaxable = 0;
    let totalCgst = 0, totalSgst = 0, totalIgst = 0, totalTax = 0, grandTotal = 0, totalCess = 0;

    // Pre-compute cessAmount per item (taxable × cessRate%)
    const cessAmounts = calcItems.map(({ product, calc }) => {
      const cessRate = Number((product as any).cessRate ?? 0);
      return r2(calc.taxable * cessRate / 100);
    });

    for (let i = 0; i < calcItems.length; i++) {
      const { calc } = calcItems[i];
      subtotal      += calc.baseAmount;
      totalDiscount += calc.discountAmt;
      totalTaxable  += calc.taxable;
      totalCgst     += calc.cgst;
      totalSgst     += calc.sgst;
      totalIgst     += calc.igst;
      totalTax      += calc.taxAmount;
      grandTotal    += calc.totalAmount;
      totalCess     += cessAmounts[i];
    }
    subtotal      = r2(subtotal);
    totalDiscount = r2(totalDiscount);
    totalTaxable  = r2(totalTaxable);
    totalCgst     = r2(totalCgst);
    totalSgst     = r2(totalSgst);
    totalIgst     = r2(totalIgst);
    totalTax      = r2(totalTax);
    totalCess     = r2(totalCess);
    grandTotal    = r2(r2(grandTotal) + totalCess);

    // ── 5. Payment resolution ────────────────────────────
    let paidAmount = dto.paidAmount ?? grandTotal;
    paidAmount     = r2(paidAmount);

    if (dto.paymentMode === PaymentModeEnum.SPLIT) {
      const splitTotal = r2((dto.cashAmount ?? 0) + (dto.upiAmount ?? 0) + (dto.cardAmount ?? 0));
      if (Math.abs(splitTotal - grandTotal) > 0.01) {
        throw new BadRequestException(
          `Split amounts (₹${splitTotal}) must equal grand total (₹${grandTotal})`,
        );
      }
      paidAmount = grandTotal;
    }

    if (paidAmount > grandTotal) {
      throw new BadRequestException('Paid amount cannot exceed grand total');
    }

    const balanceAmount = r2(grandTotal - paidAmount);
    const saleType      = balanceAmount > 0 ? 'CREDIT' : 'CASH';

    // ── 6. Atomic transaction ────────────────────────────
    const isEstimate = billType === 'ESTIMATE';
    const validityDate = isEstimate
      ? new Date(Date.now() + (dto.estimateValidityDays ?? 3) * 86400000)
      : undefined;

    const bill = await this.prisma.$transaction(async (tx) => {
      // 6a. Stock check — skip for estimates
      if (!isEstimate) {
        for (const { dto: item, product } of calcItems) {
          if (!product.allowNegativeStock) {
            const agg = await tx.stockLedger.aggregate({
              where: { productId: item.productId, branchId: counter.branchId },
              _sum: { quantity: true },
            });
            const available = Number(agg._sum.quantity ?? 0);
            if (available < item.quantity) {
              throw new BadRequestException({
                error:        'INSUFFICIENT_STOCK',
                productName:  product.name,
                currentStock: available,
                requestedQty: item.quantity,
                message:      `Insufficient stock for "${product.name}". Available: ${available}, Required: ${item.quantity}`,
              });
            }
          }
        }
      }

      // 6b. Atomic bill number generation
      const updatedSeries = await tx.billSeries.update({
        where: { id: billSeries.id },
        data: { currentNumber: { increment: 1 } },
      });
      const padLen    = updatedSeries.numberFormat.length;
      const billNumber = `${updatedSeries.seriesPrefix}${fy.fyCode}/${String(updatedSeries.currentNumber).padStart(padLen, '0')}`;

      // 6c. Create the bill
      const bill = await tx.salesBill.create({
        data: {
          businessId,
          branchId:        counter.branchId,
          financialYearId: fy.id,
          billSeriesId:    billSeries.id,
          billNumber,
          billType,
          isB2B:           !!(dto.customerGstin),
          estimateStatus:  isEstimate ? 'OPEN' : null,
          validityDate:    validityDate ?? null,
          customerId:      dto.customerId,
          customerName:    dto.customerName,
          customerPhone:   dto.customerPhone,
          customerGstin:   dto.customerGstin,
          supplyStateCode: supplyState,
          saleType:        isEstimate ? 'CASH' : saleType,
          paymentMode:     dto.paymentMode,
          subtotalAmount:  subtotal,
          discountAmount:  totalDiscount,
          taxableAmount:   totalTaxable,
          cgstTotal:       totalCgst,
          sgstTotal:       totalSgst,
          igstTotal:       totalIgst,
          totalTaxAmount:  totalTax,
          grandTotal,
          cessTotal:       totalCess,
          paidAmount:      isEstimate ? 0 : paidAmount,
          balanceAmount:   isEstimate ? grandTotal : balanceAmount,
          status:          isEstimate ? 'DRAFT' : 'FINAL',
          counterId:       dto.counterId,
          shiftId:         dto.shiftId,
          createdById:     userId,
          notes:           dto.notes,
          // Bill-time snapshots
          cashierName:       shift.cashierName ?? null,
          counterName:       counter.name,
          businessName:      business.name,
          businessGstin:     business.gstin ?? null,
          businessAddress:   business.address ?? null,
          financialYearCode: fy.fyCode,
          cashAmount: dto.paymentMode === PaymentModeEnum.CASH  ? r2(dto.cashAmount ?? grandTotal) :
                      dto.paymentMode === PaymentModeEnum.SPLIT ? r2(dto.cashAmount ?? 0) : null,
          upiAmount:  dto.paymentMode === PaymentModeEnum.UPI   ? grandTotal :
                      dto.paymentMode === PaymentModeEnum.SPLIT ? r2(dto.upiAmount ?? 0) : null,
          cardAmount: dto.paymentMode === PaymentModeEnum.CARD  ? grandTotal :
                      dto.paymentMode === PaymentModeEnum.SPLIT ? r2(dto.cardAmount ?? 0) : null,
        },
      });

      // 6d. Insert sales items; stock ledger only for real bills (not estimates)
      for (let idx = 0; idx < calcItems.length; idx++) {
        const { dto: item, product, tax, calc } = calcItems[idx];
        const cessAmt = cessAmounts[idx];
        await tx.salesItem.create({
          data: {
            billId:          bill.id,
            productId:       item.productId,
            taxId:           item.taxId,
            productName:     product.name,
            hsnCode:         product.hsnCode,
            quantity:        item.quantity,
            unitPrice:       item.unitPrice,
            discountPercent: item.discountPercent ?? 0,
            discountAmount:  calc.discountAmt,
            taxableAmount:   calc.taxable,
            gstRatePercent:  Number(tax.taxRate),
            cgstAmount:      calc.cgst,
            sgstAmount:      calc.sgst,
            igstAmount:      calc.igst,
            totalAmount:     r2(calc.totalAmount + cessAmt),
            unitOfMeasure:   product.unitOfMeasure,
            mrp:             Number(product.mrp),
            isPriceOverridden: item.isPriceOverridden ?? false,
            originalPrice:     item.originalPrice ?? null,
            overrideReason:    item.overrideReason ?? null,
            ...({ cessAmount: cessAmt } as any),
          },
        });

        if (!isEstimate) {
          await tx.stockLedger.create({
            data: {
              businessId,
              branchId:      counter.branchId,
              productId:     item.productId,
              movementType:  'SALE',
              quantity:      -item.quantity,
              referenceType: 'SALES_BILL',
              referenceId:   bill.id,
            },
          });

          // Deduct PLU stock in FEFO order (expiry-tracked) or FIFO (non-tracked)
          const orderBy: any[] = product.expiryTracking
            ? [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }]
            : [{ createdAt: 'asc' }];

          const plus = await tx.productPlu.findMany({
            where: { productId: item.productId, businessId, isActive: true, stockOnHand: { gt: 0 } },
            orderBy,
          });

          let remaining = item.quantity;
          for (const plu of plus) {
            if (remaining <= 0) break;
            const deduct = Math.min(remaining, Number(plu.stockOnHand));
            await tx.productPlu.update({
              where: { id: plu.id },
              data:  { stockOnHand: { decrement: deduct } },
            });
            remaining -= deduct;
          }
        }
      }

      // 6e. Update shift totals — estimates don't affect shift
      if (isEstimate) {
        return tx.salesBill.findUnique({ where: { id: bill.id }, include: { items: true, branch: true, posCounter: true } });
      }

      const shiftInc: Record<string, any> = {
        totalSales: { increment: grandTotal },
        totalBills: { increment: 1 },
      };
      if (dto.paymentMode === PaymentModeEnum.CASH) {
        shiftInc.totalCash = { increment: grandTotal };
      } else if (dto.paymentMode === PaymentModeEnum.UPI) {
        shiftInc.totalUpi = { increment: grandTotal };
      } else if (dto.paymentMode === PaymentModeEnum.CARD) {
        shiftInc.totalCard = { increment: grandTotal };
      } else if (dto.paymentMode === PaymentModeEnum.SPLIT) {
        if (dto.cashAmount) shiftInc.totalCash = { increment: r2(dto.cashAmount) };
        if (dto.upiAmount)  shiftInc.totalUpi  = { increment: r2(dto.upiAmount) };
        if (dto.cardAmount) shiftInc.totalCard = { increment: r2(dto.cardAmount) };
      }
      await tx.posShift.update({ where: { id: dto.shiftId }, data: shiftInc });

      // 6f. If CREDIT: update customer outstanding balance
      if (saleType === 'CREDIT' && dto.customerId) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { outstandingBalance: { increment: balanceAmount } },
        });
      }

      // Return full bill with items
      return tx.salesBill.findUnique({
        where: { id: bill.id },
        include: { items: true, branch: true, posCounter: true },
      });
    }, { timeout: 15000 });

    // Fire-and-forget stock check (skip for estimates)
    if (!isEstimate) {
      this.checkStockAfterSale(businessId, counter.branchId, dto.items.map((i) => i.productId)).catch(() => {});
    }

    return bill;
  }

  // ─── ESTIMATES ────────────────────────────────────────

  async getEstimates(businessId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { businessId, billType: 'ESTIMATE' };

    // Auto-expire open estimates past validity date
    const now = new Date();
    await this.prisma.salesBill.updateMany({
      where: { businessId, billType: 'ESTIMATE', estimateStatus: 'OPEN', validityDate: { lt: now } },
      data:  { estimateStatus: 'EXPIRED' },
    });

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { select: { name: true } } } },
          createdBy: { select: { fullName: true } },
        },
      }),
      this.prisma.salesBill.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async convertEstimate(businessId: string, userId: string, estimateId: string, targetBillType: string) {
    const estimate = await this.prisma.salesBill.findFirst({
      where: { id: estimateId, businessId, billType: 'ESTIMATE', estimateStatus: 'OPEN' },
      include: { items: true },
    });
    if (!estimate) throw new NotFoundException('Open estimate not found');

    const counter = await this.prisma.posCounter.findFirst({ where: { id: estimate.counterId!, businessId } });
    if (!counter) throw new BadRequestException('Counter not found');

    const fy = await this.prisma.financialYear.findFirst({ where: { businessId, isActive: true }, orderBy: { startDate: 'desc' } });
    if (!fy) throw new BadRequestException('No active financial year');

    const billSeries = await this.prisma.billSeries.findFirst({
      where: { businessId, financialYearId: fy.id, billType: targetBillType, isActive: true },
    }) ?? await this.prisma.billSeries.findFirst({ where: { businessId, financialYearId: fy.id, isActive: true } });
    if (!billSeries) throw new BadRequestException('No bill series for ' + targetBillType);

    const branchId = counter.branchId;

    return this.prisma.$transaction(async (tx) => {
      // Stock check
      for (const item of estimate.items) {
        const agg = await tx.stockLedger.aggregate({ where: { productId: item.productId, branchId }, _sum: { quantity: true } });
        const available = Number(agg._sum.quantity ?? 0);
        if (available < Number(item.quantity)) {
          const p = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true } });
          throw new BadRequestException(`Insufficient stock for "${p?.name}". Available: ${available}`);
        }
      }

      // Generate bill number
      const updated = await tx.billSeries.update({ where: { id: billSeries.id }, data: { currentNumber: { increment: 1 } } });
      const padLen  = updated.numberFormat.length;
      const billNumber = `${updated.seriesPrefix}${fy.fyCode}/${String(updated.currentNumber).padStart(padLen, '0')}`;

      // Create real bill
      const newBill = await tx.salesBill.create({
        data: {
          businessId,
          branchId,
          financialYearId: fy.id,
          billSeriesId:    billSeries.id,
          billNumber,
          billType:        targetBillType,
          isB2B:           estimate.isB2B,
          customerId:      estimate.customerId,
          customerName:    estimate.customerName,
          customerPhone:   estimate.customerPhone,
          customerGstin:   estimate.customerGstin,
          supplyStateCode: estimate.supplyStateCode,
          saleType:        'CASH',
          paymentMode:     'CASH',
          subtotalAmount:  estimate.subtotalAmount,
          discountAmount:  estimate.discountAmount,
          taxableAmount:   estimate.taxableAmount,
          cgstTotal:       estimate.cgstTotal,
          sgstTotal:       estimate.sgstTotal,
          igstTotal:       estimate.igstTotal,
          totalTaxAmount:  estimate.totalTaxAmount,
          grandTotal:      estimate.grandTotal,
          paidAmount:      estimate.grandTotal,
          balanceAmount:   0,
          status:          'FINAL',
          counterId:       estimate.counterId,
          shiftId:         estimate.shiftId,
          createdById:     userId,
        },
      });

      // Copy items + deduct stock
      for (const item of estimate.items) {
        await tx.salesItem.create({
          data: { ...item, id: undefined, billId: newBill.id } as any,
        });
        await tx.stockLedger.create({
          data: { businessId, branchId, productId: item.productId, movementType: 'SALE', quantity: -Number(item.quantity), referenceType: 'SALES_BILL', referenceId: newBill.id },
        });
      }

      // Mark estimate as converted
      await tx.salesBill.update({
        where: { id: estimateId },
        data: { estimateStatus: 'CONVERTED', convertedToBillId: newBill.id, convertedAt: new Date(), status: 'CANCELLED' },
      });

      return newBill;
    }, { timeout: 15000 });
  }

  async cancelEstimate(businessId: string, estimateId: string) {
    const estimate = await this.prisma.salesBill.findFirst({
      where: { id: estimateId, businessId, billType: 'ESTIMATE', estimateStatus: 'OPEN' },
    });
    if (!estimate) throw new NotFoundException('Open estimate not found');
    return this.prisma.salesBill.update({
      where: { id: estimateId },
      data: { estimateStatus: 'CANCELLED', status: 'CANCELLED' },
    });
  }

  private async checkStockAfterSale(businessId: string, branchId: string, productIds: string[]) {
    const unique = [...new Set(productIds)];
    for (const productId of unique) {
      try {
        const agg = await this.prisma.stockLedger.aggregate({
          where: { productId, branchId },
          _sum:  { quantity: true },
        });
        const stock = Number(agg._sum.quantity ?? 0);
        const product = await this.prisma.product.findUnique({
          where: { id: productId },
          select: { name: true, autoInactiveReason: true, reorderLevel: true, minimumStockLevel: true },
        });
        if (!product) continue;

        const reorderLevel      = Number(product.reorderLevel ?? 0);
        const minimumStockLevel = Number((product as any).minimumStockLevel ?? 0);

        if (stock <= 0 && product.autoInactiveReason !== 'OUT_OF_STOCK') {
          await this.prisma.product.update({ where: { id: productId }, data: { autoInactiveReason: 'OUT_OF_STOCK' } });
          await this.notifications.create({
            businessId, productId,
            type: 'OUT_OF_STOCK', priority: 'URGENT',
            title: `Out of Stock: ${product.name}`,
            message: 'Last unit sold. Auto-deactivated in POS. Create GRN to restock.',
            actionUrl: '/dashboard/grn/new', actionLabel: 'Create GRN',
          });
        } else if (stock > 0 && product.autoInactiveReason === 'OUT_OF_STOCK') {
          await this.prisma.product.update({ where: { id: productId }, data: { autoInactiveReason: null } });
        } else if (stock > 0 && reorderLevel > 0 && stock <= reorderLevel) {
          const recent = await this.prisma.notification.findFirst({
            where: { businessId, productId, type: 'LOW_STOCK',
              createdAt: { gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } },
          });
          if (!recent) {
            await this.notifications.create({
              businessId, productId,
              type: 'LOW_STOCK', priority: 'HIGH',
              title: `Low Stock: ${product.name}`,
              message: `Only ${stock} units remaining. Reorder level: ${reorderLevel}.`,
              actionUrl: '/dashboard/grn/new', actionLabel: 'Create GRN',
            });
          }
        }

        if (stock > 0 && minimumStockLevel > 0 && stock < minimumStockLevel) {
          const recent = await this.prisma.notification.findFirst({
            where: { businessId, productId, type: 'LOW_STOCK_ALERT',
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          });
          if (!recent) {
            await this.notifications.create({
              businessId, productId,
              type: 'LOW_STOCK_ALERT', priority: 'NORMAL',
              title: `Stock Below Minimum: ${product.name}`,
              message: `Stock (${stock} units) is below the minimum level (${minimumStockLevel}).`,
              actionUrl: '/dashboard/grn/new', actionLabel: 'Create GRN',
            });
          }
        }
      } catch { /* swallow per-product errors */ }
    }
  }

  async getBills(businessId: string, query: BillQueryDto) {
    const page  = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;

    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.billDate = {};
      if (query.startDate) where.billDate.gte = new Date(query.startDate);
      if (query.endDate)   where.billDate.lte = new Date(query.endDate + 'T23:59:59');
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.salesBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, fullName: true } },
          posCounter: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.salesBill.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getBillById(businessId: string, id: string) {
    const bill = await this.prisma.salesBill.findFirst({
      where: { id, businessId },
      include: {
        items: {
          include: { product: { select: { name: true, barcode: true, unitOfMeasure: true } }, tax: true },
        },
        branch: true,
        posCounter: true,
        posShift: { include: { cashier: { select: { id: true, fullName: true } } } },
        createdBy: { select: { id: true, fullName: true } },
        customer: { select: { id: true, name: true, phone: true, gstin: true } },
        financialYear: true,
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  // ─── POS PRODUCT SEARCH ───────────────────────────────

  async searchProducts(businessId: string, q: string) {
    if (!q?.trim()) return [];
    const branchId = await this.getFirstBranchId(businessId);
    return this.products.smartSearch(businessId, q.trim(), branchId);
  }

  // ─── STOCK ────────────────────────────────────────────

  async getStock(businessId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundException('Product not found');

    const branchId = await this.getFirstBranchId(businessId);
    const stock    = await this.getStockCount(productId, branchId);

    return { productId, productName: product.name, branchId, currentStock: stock };
  }

  // ─── PLU LOOKUP ───────────────────────────────────────

  async getProductPlus(barcode: string, businessId: string) {
    const product = await this.prisma.product.findFirst({
      where: { barcode, businessId, isActive: true },
      select: { id: true, name: true, barcode: true, taxId: true, unitOfMeasure: true, gstRatePercent: true, cessRate: true, allowNegativeStock: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const plus = await this.prisma.productPlu.findMany({
      where: {
        productId:  product.id,
        businessId,
        isActive:   true,
        isArchived: false,
        stockOnHand: { gt: 0 },
      },
      orderBy: { receivedDate: 'asc' },
      select: {
        pluCode:     true,
        mrp:         true,
        sellingPrice: true,
        stockOnHand: true,
        receivedDate: true,
        batchNumber: true,
      },
    });

    return {
      productId:        product.id,
      productName:      product.name,
      barcode:          product.barcode,
      taxId:            product.taxId,
      unitOfMeasure:    product.unitOfMeasure,
      gstRatePercent:   product.gstRatePercent,
      cessRate:         product.cessRate,
      allowNegativeStock: product.allowNegativeStock,
      plus: plus.map((p) => ({
        pluCode:      p.pluCode,
        mrp:          Number(p.mrp),
        sellingPrice: Number(p.sellingPrice),
        stockOnHand:  Number(p.stockOnHand),
        receivedDate: p.receivedDate.toISOString(),
        batchNumber:  p.batchNumber ?? null,
      })),
    };
  }

  // ─── HELD BILLS ───────────────────────────────────────

  async createHold(
    userId: string,
    userName: string,
    businessId: string,
    dto: CreateHoldDto,
  ) {
    const branchId = await this.getFirstBranchId(businessId);

    // Generate sequential hold number within business
    const count = await this.prisma.heldBill.count({ where: { businessId } });
    const holdNumber = `HOLD-${String(count + 1).padStart(5, '0')}`;

    const held = await this.prisma.heldBill.create({
      data: {
        holdNumber,
        businessId,
        branchId,
        createdByUserId: userId,
        createdByName:   userName,
        counterName:     dto.counterName ?? 'Counter',
        billType:        dto.billType ?? 'TAX_INVOICE',
        customerId:      dto.customerId,
        customerName:    dto.customerName,
        customerPhone:   dto.customerPhone,
        customerGstin:   dto.customerGstin,
        isB2B:           dto.isB2B ?? false,
        itemsJson:       JSON.stringify(dto.items),
        subtotal:        dto.subtotal,
        grandTotal:      dto.grandTotal,
        itemCount:       dto.itemCount,
        status:          'HELD',
      },
    });

    return { id: held.id, holdNumber: held.holdNumber };
  }

  async getHeldBills(businessId: string) {
    const rows = await this.prisma.heldBill.findMany({
      where: { businessId, status: 'HELD' },
      orderBy: { heldAt: 'asc' },
    });

    const now = Date.now();
    return rows.map((h) => {
      const hoursHeld = (now - h.heldAt.getTime()) / 3600000;
      const ageStatus = hoursHeld < 1 ? 'FRESH' : hoursHeld < 4 ? 'AGING' : 'OLD';
      return {
        id:          h.id,
        holdNumber:  h.holdNumber,
        billType:    h.billType,
        customerName: h.customerName,
        customerPhone: h.customerPhone,
        customerId:  h.customerId,
        customerGstin: h.customerGstin,
        isB2B:       h.isB2B,
        itemCount:   h.itemCount,
        grandTotal:  Number(h.grandTotal),
        subtotal:    Number(h.subtotal),
        counterName: h.counterName,
        createdByName: h.createdByName,
        heldAt:      h.heldAt,
        hoursHeld:   Math.round(hoursHeld * 10) / 10,
        ageStatus,
        items:       JSON.parse(h.itemsJson),
      };
    });
  }

  async deleteHold(id: string, businessId: string) {
    const hold = await this.prisma.heldBill.findFirst({ where: { id, businessId } });
    if (!hold) throw new NotFoundException('Held bill not found');
    await this.prisma.heldBill.update({ where: { id }, data: { status: 'DELETED' } });
    return { success: true };
  }

  async completeHold(id: string, businessId: string) {
    const hold = await this.prisma.heldBill.findFirst({ where: { id, businessId, status: 'HELD' } });
    if (!hold) throw new NotFoundException('Held bill not found');
    await this.prisma.heldBill.update({ where: { id }, data: { status: 'COMPLETED' } });
    return { success: true };
  }

  // ─── DUPLICATE BILL SEARCH ────────────────────────────

  async searchBills(businessId: string, query: {
    billNumber?: string;
    phone?: string;
    customerName?: string;
    date?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {
      businessId,
      billType:  { not: 'ESTIMATE' },
      status:    'FINAL',
    };

    if (query.billNumber) {
      where.billNumber = { contains: query.billNumber, mode: 'insensitive' };
    }
    if (query.phone) {
      where.customerPhone = query.phone.trim();
    }
    if (query.customerName) {
      where.customerName = { contains: query.customerName.trim(), mode: 'insensitive' };
    }
    if (query.date) {
      const d = new Date(query.date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      where.billDate = { gte: start, lte: end };
    }

    const limit  = Math.min(query.limit ?? 20, 100);
    const offset = query.offset ?? 0;
    const select = {
      id: true, billNumber: true, billType: true, isB2B: true,
      customerName: true, customerPhone: true, customerGstin: true,
      grandTotal: true, createdAt: true, paymentMode: true, billDate: true,
      isVoided: true, voidedAt: true, voidReason: true,
      cashAmount: true, upiAmount: true, cardAmount: true,
      _count: { select: { items: true } },
      createdBy:  { select: { fullName: true, id: true } },
      posCounter: { select: { name: true } },
      posShift:   { select: { id: true } },
    };

    const [rows, total] = await Promise.all([
      this.prisma.salesBill.findMany({ where, take: limit, skip: offset, orderBy: { billDate: 'desc' }, select }),
      this.prisma.salesBill.count({ where }),
    ]);

    const bills = rows.map((b) => ({
      ...b,
      grandTotal:  Number(b.grandTotal),
      itemCount:   b._count.items,
      cashierName: b.createdBy?.fullName ?? '',
      counterName: b.posCounter?.name ?? '',
      createdById: b.createdBy?.id ?? null,
      shiftId:     b.posShift?.id ?? null,
    }));

    return { bills, total, hasMore: offset + bills.length < total };
  }

  async getFullBillForPrint(id: string, businessId: string) {
    const bill = await this.prisma.salesBill.findFirst({
      where: { id, businessId },
      include: {
        items: {
          include: {
            // Keep product join for non-financial fields only (barcode, return policy)
            product: { select: { barcode: true, isReturnable: true, returnPeriodDays: true } },
          },
        },
        branch:   { select: { phone: true } },
        posShift: { select: { id: true } },
        customer: { select: { name: true, phone: true, gstin: true } },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');

    // Business details: prefer bill snapshots, fall back to live DB for phone/fssai
    const businessDb = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { phone: true, fssaiLicense: true, stateCode: true },
    });

    const business = {
      name:         bill.businessName  ?? '',
      gstin:        bill.businessGstin ?? null,
      address:      bill.businessAddress ?? null,
      phone:        businessDb?.phone        ?? null,
      fssaiLicense: businessDb?.fssaiLicense ?? null,
      stateCode:    businessDb?.stateCode    ?? '36',
    };

    return { bill, business };
  }

  async logDuplicatePrint(id: string, businessId: string, userId: string, userName: string, counterName: string) {
    const bill = await this.prisma.salesBill.findFirst({ where: { id, businessId } });
    if (!bill) throw new NotFoundException('Bill not found');

    await this.prisma.auditLog.create({
      data: {
        userId,
        businessId,
        actionType:  'DUPLICATE_BILL_PRINTED',
        entityType:  'sales_bill',
        entityId:    id,
        newValues:   { billNumber: bill.billNumber, printedBy: userName, counter: counterName, at: new Date().toISOString() },
      },
    });

    return { success: true, billNumber: bill.billNumber };
  }

  // ─── VOID BILL ────────────────────────────────────────

  async voidBill(
    businessId: string,
    userId: string,
    userRole: string,
    userShiftId: string | null,
    billId: string,
    reason: string,
    userName: string,
  ) {
    const bill = await this.prisma.salesBill.findFirst({
      where: { id: billId, businessId },
      include: { items: true },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    if (bill.isVoided) throw new BadRequestException('Bill is already voided');
    if (bill.status === 'CANCELLED') throw new BadRequestException('Cannot void a cancelled bill');
    if (bill.billType === 'ESTIMATE') throw new BadRequestException('Cannot void an estimate');

    // Check today's day closure
    const branchId = bill.branchId;
    const closureDate = new Date(); closureDate.setHours(0, 0, 0, 0);
    const closure = await this.prisma.dayClosure.findFirst({
      where: { businessId, branchId, closureDate, status: 'COMPLETED' },
    });
    if (closure) throw new BadRequestException('Cannot void bill: today\'s day closure is already completed');

    // Role-based checks
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const billDay = new Date(bill.billDate); billDay.setHours(0, 0, 0, 0);
    if (billDay.getTime() !== today.getTime()) {
      throw new BadRequestException('Can only void bills created today');
    }

    const isSupervisor = ['SUPER_ADMIN', 'BRANCH_MANAGER'].includes(userRole);
    if (!isSupervisor) {
      if (bill.createdById !== userId) {
        throw new BadRequestException('Cashiers can only void their own bills');
      }
      if (userShiftId && bill.shiftId !== userShiftId) {
        throw new BadRequestException('Cashiers can only void bills from their current shift');
      }
    }

    // Run void in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.salesBill.update({
        where: { id: billId },
        data: {
          isVoided:    true,
          voidedAt:    new Date(),
          voidedById:  userId,
          voidedByName: userName,
          voidReason:  reason,
        },
      });

      for (const item of bill.items) {
        await tx.stockLedger.create({
          data: {
            businessId,
            branchId,
            productId:     item.productId,
            movementType:  'SALE_VOID',
            quantity:      Number(item.quantity),  // positive — stock returns
            referenceType: 'VOID',
            referenceId:   billId,
            notes:         `Bill voided: ${reason}`,
          },
        });

        await tx.product.updateMany({
          where: { id: item.productId, autoInactiveReason: 'OUT_OF_STOCK' },
          data:  { autoInactiveReason: null },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          businessId,
          actionType: 'BILL_VOIDED',
          entityType: 'sales_bill',
          entityId:   billId,
          oldValues:  { status: 'FINAL', billNumber: bill.billNumber },
          newValues:  { isVoided: true, reason },
        },
      });
    }, { timeout: 15000 });

    this.notifications.create({
      businessId,
      type:     'BILL_VOIDED',
      priority: 'NORMAL',
      title:    `Bill Voided: ${bill.billNumber}`,
      message:  `Voided by ${userName}. Reason: ${reason}`,
    }).catch(() => {});

    return {
      success:       true,
      stockReversed: true,
      billNumber:    bill.billNumber,
      items:         bill.items.map((i) => ({
        productId:      i.productId,
        taxId:          i.taxId,
        productName:    i.productName,
        quantity:       Number(i.quantity),
        unitPrice:      Number(i.unitPrice),
        discountPercent: Number(i.discountPercent),
        gstRatePercent: Number(i.gstRatePercent),
        totalAmount:    Number(i.totalAmount),
        unitOfMeasure:  i.unitOfMeasure ?? 'PCS',
      })),
    };
  }

  // ─── CREDIT NOTES ─────────────────────────────────────

  async createCreditNote(
    businessId: string,
    userId: string,
    userName: string,
    dto: { originalBillId: string; reason: string; items: { productId: string; quantity: number; unitPrice: number }[]; refundMode: string },
  ) {
    const originalBill = await this.prisma.salesBill.findFirst({
      where: { id: dto.originalBillId, businessId, status: 'FINAL' },
      include: {
        items: { include: { tax: { select: { taxRate: true } } } },
        branch: { select: { id: true } },
      },
    });
    if (!originalBill) throw new NotFoundException('Original bill not found or not finalized');
    if (originalBill.isVoided) throw new BadRequestException('Cannot create credit note for a voided bill');

    // Validate items exist in original bill
    const originalItemMap = new Map(originalBill.items.map((i) => [i.productId, i]));
    for (const item of dto.items) {
      const orig = originalItemMap.get(item.productId);
      if (!orig) throw new BadRequestException(`Product ${item.productId} not found in original bill`);
      if (item.quantity > Number(orig.quantity)) {
        throw new BadRequestException(`Cannot return more than purchased quantity for ${orig.productName}`);
      }
    }

    // Get or create CN bill series
    const fy = await this.prisma.financialYear.findFirst({
      where: { businessId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!fy) throw new BadRequestException('No active financial year');

    const branchId = originalBill.branch.id;

    // Calculate amounts
    const r2 = (n: number) => Math.round(n * 100) / 100;
    let subtotalAmount = 0, cgstAmount = 0, sgstAmount = 0, taxAmount = 0, totalAmount = 0;
    const cnItems: Array<{
      productId: string; productName: string; hsnCode: string | null;
      quantity: number; unitPrice: number; gstRatePercent: number;
      cgstAmount: number; sgstAmount: number; totalAmount: number;
    }> = [];

    for (const item of dto.items) {
      const orig = originalItemMap.get(item.productId)!;
      const gstRate = Number(orig.tax.taxRate);
      const lineTotal = r2(item.unitPrice * item.quantity);
      const taxable  = r2(lineTotal / (1 + gstRate / 100));
      const tax      = r2(lineTotal - taxable);
      const cgst     = r2(tax / 2);
      const sgst     = r2(tax - cgst);

      subtotalAmount += lineTotal;
      cgstAmount     += cgst;
      sgstAmount     += sgst;
      taxAmount      += tax;
      totalAmount    += lineTotal;

      cnItems.push({
        productId:      item.productId,
        productName:    orig.productName,
        hsnCode:        orig.hsnCode,
        quantity:       item.quantity,
        unitPrice:      item.unitPrice,
        gstRatePercent: gstRate,
        cgstAmount:     cgst,
        sgstAmount:     sgst,
        totalAmount:    lineTotal,
      });
    }

    // Generate credit note number
    const cnSeries = await this.prisma.billSeries.findFirst({
      where: { businessId, financialYearId: fy.id, billType: 'CREDIT_NOTE' },
    });

    const cn = await this.prisma.$transaction(async (tx) => {
      let series = cnSeries;
      if (!series) {
        series = await tx.billSeries.create({
          data: {
            businessId,
            financialYearId: fy.id,
            billType:    'CREDIT_NOTE',
            seriesPrefix: 'CN/',
            currentNumber: 0,
            numberFormat: '0000',
            isActive: true,
          },
        });
      }
      const updated = await tx.billSeries.update({
        where: { id: series.id },
        data: { currentNumber: { increment: 1 } },
      });
      const creditNoteNumber = `CN/${fy.fyCode}/${String(updated.currentNumber).padStart(4, '0')}`;

      // Create credit note
      const creditNote = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          businessId,
          branchId,
          originalBillId:     dto.originalBillId,
          originalBillNumber: originalBill.billNumber ?? '',
          customerId:   originalBill.customerId,
          customerName: originalBill.customerName,
          customerPhone: originalBill.customerPhone,
          reason:        dto.reason,
          subtotalAmount: r2(subtotalAmount),
          taxAmount:      r2(taxAmount),
          cgstAmount:     r2(cgstAmount),
          sgstAmount:     r2(sgstAmount),
          totalAmount:    r2(totalAmount),
          refundMode:     dto.refundMode,
          refundStatus:   'PENDING',
          createdById:    userId,
          createdByName:  userName,
          items: {
            create: cnItems.map((i) => ({
              productId:      i.productId,
              productName:    i.productName,
              hsnCode:        i.hsnCode,
              quantity:       i.quantity,
              unitPrice:      i.unitPrice,
              gstRatePercent: i.gstRatePercent,
              cgstAmount:     i.cgstAmount,
              sgstAmount:     i.sgstAmount,
              totalAmount:    i.totalAmount,
            })),
          },
        },
        include: { items: true },
      });

      // Stock reversal for returned items
      for (const item of cnItems) {
        await tx.stockLedger.create({
          data: {
            businessId,
            branchId,
            productId:     item.productId,
            movementType:  'SALE_RETURN',
            quantity:      item.quantity,
            referenceType: 'CREDIT_NOTE',
            referenceId:   creditNote.id,
            notes:         `Credit note ${creditNoteNumber}: ${dto.reason}`,
          },
        });
        await tx.product.updateMany({
          where: { id: item.productId, autoInactiveReason: 'OUT_OF_STOCK' },
          data:  { autoInactiveReason: null },
        });
      }

      // If store credit: update customer balance
      if (dto.refundMode === 'STORE_CREDIT' && originalBill.customerId) {
        await tx.customer.update({
          where: { id: originalBill.customerId },
          data: { outstandingBalance: { decrement: r2(totalAmount) } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          businessId,
          actionType: 'CREDIT_NOTE_CREATED',
          entityType: 'credit_note',
          entityId:   creditNote.id,
          newValues:  { creditNoteNumber, originalBillNumber: originalBill.billNumber, totalAmount: r2(totalAmount), refundMode: dto.refundMode },
        },
      });

      return creditNote;
    }, { timeout: 15000 });

    this.notifications.create({
      businessId,
      type:     'SYSTEM',
      priority: 'NORMAL',
      title:    `Credit Note Created: ${cn.creditNoteNumber}`,
      message:  `Against bill ${originalBill.billNumber}. Amount: Rs.${r2(totalAmount)}. Mode: ${dto.refundMode}`,
    }).catch(() => {});

    return cn;
  }

  async getCreditNotes(businessId: string, query: {
    date?: string;
    originalBillId?: string;
    customerName?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip  = (page - 1) * limit;
    const where: any = { businessId };
    if (query.originalBillId) where.originalBillId = query.originalBillId;
    if (query.customerName)   where.customerName   = { contains: query.customerName, mode: 'insensitive' };
    if (query.date) {
      const d = new Date(query.date);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end   = new Date(d); end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.creditNote.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { items: true } }),
      this.prisma.creditNote.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCreditNoteById(businessId: string, id: string) {
    const cn = await this.prisma.creditNote.findFirst({
      where: { id, businessId },
      include: { items: true },
    });
    if (!cn) throw new NotFoundException('Credit note not found');
    return cn;
  }

  // ─── HISTORICAL BILLS ────────────────────────────────

  async createHistoricalBill(businessId: string, userId: string, dto: {
    type: 'B2C_SUMMARY' | 'B2B_INDIVIDUAL';
    billDate: string;
    // B2C fields
    gstRate?: number;
    taxableAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    // B2B fields
    invoiceNumber?: string;
    customerName?: string;
    customerGstin?: string;
    igstAmount?: number;
  }) {
    const FY_START = new Date('2026-04-01');
    const today    = new Date(); today.setHours(23, 59, 59, 999);
    const billDate = new Date(dto.billDate);

    if (isNaN(billDate.getTime())) throw new BadRequestException('Invalid bill date');
    if (billDate > today)          throw new BadRequestException('Cannot enter future date');
    if (billDate < FY_START)       throw new BadRequestException('Cannot enter bills before April 1, 2026');

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('Business not found');

    const branchId = await this.getFirstBranchId(businessId);

    const fy = await this.prisma.financialYear.findFirst({
      where: { businessId, startDate: { lte: billDate }, endDate: { gte: billDate } },
    }) ?? await this.prisma.financialYear.findFirst({
      where: { businessId, isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!fy) throw new BadRequestException('No financial year found for this date');

    const histCount = await this.prisma.salesBill.count({ where: { businessId, isHistorical: true } });
    const billNumber = `HIST/${fy.fyCode}/${String(histCount + 1).padStart(5, '0')}`;

    const businessStateCode = business.stateCode ?? '36';

    if (dto.type === 'B2C_SUMMARY') {
      if (dto.taxableAmount === undefined) throw new BadRequestException('taxableAmount required for B2C summary');
      const gstRate   = dto.gstRate ?? 0;
      const taxable   = r2(dto.taxableAmount);
      const cgst      = dto.cgstAmount !== undefined ? r2(dto.cgstAmount) : r2(taxable * gstRate / 200);
      const sgst      = dto.sgstAmount !== undefined ? r2(dto.sgstAmount) : r2(taxable * gstRate / 200);
      const totalTax  = r2(cgst + sgst);
      const grand     = r2(taxable + totalTax);

      const bill = await this.prisma.salesBill.create({
        data: {
          businessId,
          branchId,
          financialYearId: fy.id,
          billNumber,
          billDate:        billDate,
          billType:        'RETAIL_INVOICE',
          isB2B:           false,
          isHistorical:    true,
          customerName:    'Walk-in Customers',
          supplyStateCode: businessStateCode,
          saleType:        'CASH',
          paymentMode:     'CASH',
          subtotalAmount:  grand,
          taxableAmount:   taxable,
          cgstTotal:       cgst,
          sgstTotal:       sgst,
          igstTotal:       0,
          totalTaxAmount:  totalTax,
          grandTotal:      grand,
          paidAmount:      grand,
          balanceAmount:   0,
          status:          'FINAL',
          createdById:     userId,
          businessName:    business.name,
          businessGstin:   business.gstin ?? null,
          businessAddress: business.address ?? null,
          financialYearCode: fy.fyCode,
          notes: JSON.stringify({ gstRate, isHistoricalSummary: true }),
        },
      });
      return bill;
    }

    // B2B_INDIVIDUAL
    if (!dto.invoiceNumber) throw new BadRequestException('invoiceNumber required for B2B bill');
    if (!dto.customerName)  throw new BadRequestException('customerName required for B2B bill');
    if (!dto.customerGstin) throw new BadRequestException('customerGstin required for B2B bill');
    if (dto.taxableAmount === undefined) throw new BadRequestException('taxableAmount required');

    const gstRate   = dto.gstRate ?? 18;
    const taxable   = r2(dto.taxableAmount);
    const custState = dto.customerGstin.substring(0, 2);
    const isIntra   = custState === businessStateCode;
    const cgst      = isIntra ? r2(taxable * gstRate / 200) : 0;
    const sgst      = isIntra ? r2(taxable * gstRate / 200) : 0;
    const igst      = !isIntra ? r2(taxable * gstRate / 100) : 0;
    const cgstFinal = dto.cgstAmount !== undefined ? r2(dto.cgstAmount) : cgst;
    const sgstFinal = dto.sgstAmount !== undefined ? r2(dto.sgstAmount) : sgst;
    const igstFinal = dto.igstAmount !== undefined ? r2(dto.igstAmount) : igst;
    const totalTax  = r2(cgstFinal + sgstFinal + igstFinal);
    const grand     = r2(taxable + totalTax);

    return this.prisma.salesBill.create({
      data: {
        businessId,
        branchId,
        financialYearId: fy.id,
        billNumber,
        billDate:        billDate,
        billType:        'TAX_INVOICE',
        isB2B:           true,
        isHistorical:    true,
        customerName:    dto.customerName,
        customerGstin:   dto.customerGstin,
        supplyStateCode: custState,
        saleType:        'CASH',
        paymentMode:     'CASH',
        subtotalAmount:  grand,
        taxableAmount:   taxable,
        cgstTotal:       cgstFinal,
        sgstTotal:       sgstFinal,
        igstTotal:       igstFinal,
        totalTaxAmount:  totalTax,
        grandTotal:      grand,
        paidAmount:      grand,
        balanceAmount:   0,
        status:          'FINAL',
        createdById:     userId,
        businessName:    business.name,
        businessGstin:   business.gstin ?? null,
        businessAddress: business.address ?? null,
        financialYearCode: fy.fyCode,
        notes: JSON.stringify({ gstRate, originalInvoice: dto.invoiceNumber, isHistoricalB2B: true }),
      },
    });
  }

  async createHistoricalBillsBulk(businessId: string, userId: string, bills: Array<Parameters<PosService['createHistoricalBill']>[2]>) {
    const created: any[] = [];
    const errors: Array<{ index: number; message: string }> = [];

    for (let i = 0; i < bills.length; i++) {
      try {
        const bill = await this.createHistoricalBill(businessId, userId, bills[i]);
        created.push(bill);
      } catch (e: any) {
        errors.push({ index: i, message: e?.message ?? 'Unknown error' });
      }
    }

    return { created: created.length, errors };
  }

  async getHistoricalBills(businessId: string, query: { type?: string; page?: number; limit?: number }) {
    const page  = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip  = (page - 1) * limit;

    const where: any = { businessId, isHistorical: true };
    if (query.type === 'B2C') where.isB2B = false;
    if (query.type === 'B2B') where.isB2B = true;

    const [bills, total] = await this.prisma.$transaction([
      this.prisma.salesBill.findMany({
        where,
        orderBy: { billDate: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, billNumber: true, billDate: true, billType: true, isB2B: true,
          customerName: true, customerGstin: true, taxableAmount: true,
          cgstTotal: true, sgstTotal: true, igstTotal: true, grandTotal: true,
          notes: true, createdAt: true,
        },
      }),
      this.prisma.salesBill.count({ where }),
    ]);

    return {
      data: bills.map((b) => ({
        ...b,
        taxableAmount: Number(b.taxableAmount),
        cgstTotal:     Number(b.cgstTotal),
        sgstTotal:     Number(b.sgstTotal),
        igstTotal:     Number(b.igstTotal),
        grandTotal:    Number(b.grandTotal),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async deleteHistoricalBill(businessId: string, id: string) {
    const bill = await this.prisma.salesBill.findFirst({
      where: { id, businessId, isHistorical: true },
    });
    if (!bill) throw new NotFoundException('Historical bill not found');
    await this.prisma.salesBill.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  // ─── Private helpers ──────────────────────────────────

  private async getFirstBranchId(businessId: string): Promise<string> {
    const branch = await this.prisma.branch.findFirst({
      where: { businessId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!branch) {
      throw new BadRequestException('No active branch found. Complete business setup at POST /api/business/setup');
    }
    return branch.id;
  }

  private async getStockCount(productId: string, branchId: string): Promise<number> {
    const agg = await this.prisma.stockLedger.aggregate({
      where: { productId, branchId },
      _sum: { quantity: true },
    });
    return Number(agg._sum.quantity ?? 0);
  }
}
