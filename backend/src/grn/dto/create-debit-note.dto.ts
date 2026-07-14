import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsBoolean, IsNumber, Min,
  ValidateNested, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DebitNoteItemDto {
  @IsOptional() @IsString() productId?: string;
  @IsString() @IsNotEmpty() productName: string;
  @IsOptional() @IsString() hsnCode?: string;

  @Type(() => Number) @IsNumber() @Min(0.001)
  quantity: number;

  @Type(() => Number) @IsNumber() @Min(0)
  unitPrice: number;

  @Type(() => Number) @IsNumber() @Min(0)
  gstRate: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  cessRate?: number;
}

export class CreatePurchaseDebitNoteDto {
  @IsString() @IsNotEmpty() supplierId: string;

  @IsOptional() @IsString() originalGrnId?: string;
  @IsOptional() @IsString() originalInvoiceNo?: string;
  @IsOptional() @IsString() supplierCnNumber?: string;

  @IsDateString() debitNoteDate: string;
  @IsString() @IsNotEmpty() reason: string;

  @IsOptional() @IsBoolean() itcReversal?: boolean;
  @IsOptional() @IsString() notes?: string;

  @ValidateNested({ each: true })
  @Type(() => DebitNoteItemDto)
  @ArrayNotEmpty()
  items: DebitNoteItemDto[];
}
