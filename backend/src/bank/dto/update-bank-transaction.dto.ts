import { IsString, IsOptional, IsIn } from 'class-validator';

export const BANK_TXN_TYPES = [
  'SALES_PHONEPE', 'SALES_PINELABS', 'SALES_UPI', 'CASH_DEPOSIT',
  'SUPPLIER_PAYMENT', 'EXPENSE_RENT', 'EXPENSE_OTHER',
  'TRANSFER_PERSONAL', 'UNCATEGORIZED',
] as const;
export const BANK_MATCH_STATUSES = ['MATCHED', 'UNMATCHED', 'IGNORED'] as const;

export class UpdateBankTransactionDto {
  @IsOptional() @IsString() @IsIn(BANK_TXN_TYPES)
  txnType?: string;

  @IsOptional() @IsString() @IsIn(BANK_MATCH_STATUSES)
  matchStatus?: string;

  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() notes?: string;
}
