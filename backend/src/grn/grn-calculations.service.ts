import { Injectable, BadRequestException } from '@nestjs/common';
import { GrnItemDto } from './dto/grn-item.dto';

export interface ItemCalcResult {
  netCostPrice: number;
  totalReceivedQty: number;
  totalFreeQty: number;
  totalQty: number;
  taxable: number;
  cashDiscAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  lineTotal: number;
  hamaliShare: number;
  freightShare: number;
  trueCostPrice: number;
}

export interface BillTotals {
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  cessTotal: number;
  totalTaxAmount: number;
  billDiscountAmount: number;
  grandTotal: number;
}

@Injectable()
export class GrnCalculationsService {
  private r2(n: number) { return Math.round(n * 100) / 100; }

  calculateItemTotals(
    item: GrnItemDto,
    gstRate: number,
    taxType: string,
    isInterState: boolean,
  ): Omit<ItemCalcResult, 'hamaliShare' | 'freightShare' | 'trueCostPrice'> {
    const d = (v?: number) => v ?? 0;
    const r2 = this.r2.bind(this);

    // Cascade discounts applied to per-unit basic cost
    const netCostPrice = r2(
      item.basicCostPrice
      * (1 - d(item.disc1Percent) / 100)
      * (1 - d(item.disc2Percent) / 100)
      * (1 - d(item.disc3Percent) / 100)
      * (1 - d(item.disc4Percent) / 100),
    );

    const packSize = item.packSize ?? 1;
    const totalReceivedQty = r2((d(item.casesReceived) * packSize) + d(item.looseQty));
    const totalFreeQty = r2((d(item.freeCases) * packSize) + d(item.freeLoose));
    const totalQty = r2(totalReceivedQty + totalFreeQty);

    // Taxable base (paid qty only; free goods don't attract tax)
    let taxable: number;
    if (taxType === 'TAX_INCLUSIVE') {
      taxable = r2((netCostPrice / (1 + gstRate / 100)) * totalReceivedQty);
    } else {
      taxable = r2(netCostPrice * totalReceivedQty);
    }

    const cashDiscAmount = r2(taxable * d(item.cashDiscPercent) / 100);
    const taxableNet = r2(taxable - cashDiscAmount);

    const cessRate = d(item.cessRate);
    const cessAmount = r2(taxableNet * cessRate / 100);

    let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
    if (isInterState) {
      igstAmount = r2(taxableNet * gstRate / 100);
    } else {
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

  spreadAdjustments(
    calcs: Array<Omit<ItemCalcResult, 'hamaliShare' | 'freightShare' | 'trueCostPrice'>>,
    freightCharges: number,
    hamaliCharges: number,
  ): ItemCalcResult[] {
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

  calculateBillTotals(
    items: Array<Pick<ItemCalcResult, 'taxable' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'cessAmount' | 'lineTotal'>>,
    billDiscountPercent: number,
    freightCharges: number,
    hamaliCharges: number,
    otherCharges: number,
    roundingAmount: number,
  ): BillTotals {
    const r2 = this.r2.bind(this);

    const taxableTotal = r2(items.reduce((s, i) => s + i.taxable, 0));
    const cgstTotal = r2(items.reduce((s, i) => s + i.cgstAmount, 0));
    const sgstTotal = r2(items.reduce((s, i) => s + i.sgstAmount, 0));
    const igstTotal = r2(items.reduce((s, i) => s + i.igstAmount, 0));
    const cessTotal = r2(items.reduce((s, i) => s + i.cessAmount, 0));
    const totalTaxAmount = r2(cgstTotal + sgstTotal + igstTotal);
    const itemsTotal = r2(items.reduce((s, i) => s + i.lineTotal, 0));

    const billDiscountAmount = r2(taxableTotal * billDiscountPercent / 100);
    const grandTotal = r2(
      itemsTotal
      - billDiscountAmount
      + freightCharges
      + hamaliCharges
      + otherCharges
      + roundingAmount,
    );

    return { taxableTotal, cgstTotal, sgstTotal, igstTotal, cessTotal, totalTaxAmount, billDiscountAmount, grandTotal };
  }

  validateInvoiceControlTotal(calculated: number, controlTotal: number): void {
    const diff = Math.abs(calculated - controlTotal);
    if (diff > 50) {
      throw new BadRequestException(
        `Invoice total mismatch: calculated Rs.${calculated}, invoice shows Rs.${controlTotal} (diff Rs.${diff.toFixed(2)})`,
      );
    }
  }

  calculateMinimumSellingPrice(netCostPrice: number, gstRate: number, marginPct: number): number {
    const costWithTax = netCostPrice * (1 + gstRate / 100);
    return this.r2(costWithTax * (1 + marginPct / 100));
  }
}
