import {
  IsString, IsNotEmpty, IsOptional, IsDateString,
  IsNumber, IsPositive, IsEnum, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ExpensePaymentMode {
  CASH   = 'CASH',
  UPI    = 'UPI',
  CARD   = 'CARD',
  CHEQUE = 'CHEQUE',
  BANK   = 'BANK',
}

export class CreateExpenseDto {
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  category: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsOptional()
  @IsEnum(ExpensePaymentMode)
  paymentMode?: ExpensePaymentMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vendorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  referenceNo?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
