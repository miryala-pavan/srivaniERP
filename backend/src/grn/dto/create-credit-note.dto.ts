import { IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierCreditNoteDto {
  @IsString() @IsNotEmpty() supplierId: string;

  @IsOptional() @IsString() originalGrnId?: string;
  @IsOptional() @IsString() originalInvoiceNo?: string;
  @IsOptional() @IsString() supplierCnNumber?: string;

  @IsDateString() cnDate: string;
  @IsString() @IsNotEmpty() reason: string;

  @Type(() => Number) @IsNumber() @Min(0)
  taxableAmount: number;

  @Type(() => Number) @IsNumber() @Min(0)
  gstRate: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  cessAmount?: number;

  @IsOptional() @IsBoolean() itcReversal?: boolean;
  @IsOptional() @IsString() notes?: string;
}
