import {
  IsString, IsNotEmpty, IsOptional, IsDateString, ValidateNested, ArrayNotEmpty,
  IsBoolean, IsNumber, IsIn, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GrnItemDto } from './grn-item.dto';

export class CreateGrnDto {
  @IsString() @IsNotEmpty() supplierId: string;
  @IsString() @IsNotEmpty() branchId: string;
  @IsString() @IsNotEmpty() invoiceNumber: string;
  @IsDateString() invoiceDate: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) invoiceControlTotal?: number;

  @IsIn(['TAX_EXCLUSIVE', 'TAX_INCLUSIVE']) taxType: string;
  @IsOptional() @IsIn(['ELIGIBLE', 'INELIGIBLE', 'BLOCKED']) itcEligibility?: string;
  @IsOptional() @IsBoolean() rcmApplicable?: boolean;
  @IsOptional() @IsIn(['INVOICE', 'DEBIT_NOTE', 'BILL_OF_SUPPLY']) documentType?: string;
  @IsOptional() @IsString() placeOfSupply?: string;
  @IsOptional() @IsString() poNumber?: string;

  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  @ArrayNotEmpty()
  items: GrnItemDto[];

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) billDiscountPercent?: number;
  // Bill-level cash discount (linked pair from the form): Cash% and Cash Rs.
  // billCashDiscRs is the authoritative amount subtracted from the grand total.
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) billCashDiscPercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) billCashDiscRs?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freightCharges?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) hamaliCharges?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) otherCharges?: number;
  @IsOptional() @Type(() => Number) @IsNumber() roundingAmount?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) advanceAdjusted?: number;
  @IsOptional() @IsDateString() paymentDueDate?: string;
  @IsOptional() @IsString() paymentMode?: string;
  @IsOptional() @IsString() paymentReference?: string;
  @IsOptional() @IsString() paymentNotes?: string;

  @IsOptional() @IsDateString() receivedDate?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsBoolean() isDraft?: boolean;
}
