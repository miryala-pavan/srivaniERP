import { IsString, IsNotEmpty, IsOptional, IsDateString, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHistoricalBillDto {
  @IsString() @IsIn(['B2C_SUMMARY', 'B2B_INDIVIDUAL'])
  type: 'B2C_SUMMARY' | 'B2B_INDIVIDUAL';

  @IsDateString() billDate: string;

  // B2C fields
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gstRate?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) taxableAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cgstAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sgstAmount?: number;

  // B2B fields
  @IsOptional() @IsString() @IsNotEmpty() invoiceNumber?: string;
  @IsOptional() @IsString() @IsNotEmpty() customerName?: string;
  @IsOptional() @IsString() customerGstin?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) igstAmount?: number;
}
