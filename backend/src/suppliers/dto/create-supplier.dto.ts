import {
  IsString, IsNotEmpty, IsOptional, IsEmail, IsBoolean,
  IsNumber, Min, Matches, MaxLength, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export const VENDOR_TYPES = ['SUPPLIER', 'LOAN', 'RENT', 'SERVICE', 'EXPENSE', 'ONE_TIME', 'OTHER'] as const;

export class CreateSupplierDto {
  @IsString() @IsNotEmpty() name: string;

  @IsOptional() @IsString() @IsIn(VENDOR_TYPES)
  supplierType?: string;

  @IsOptional() @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GSTIN format',
  })
  gstin?: string;

  @IsOptional() @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid Indian mobile number' })
  phone?: string;

  @IsOptional() @IsEmail() email?: string;

  @IsOptional() @IsString() address?: string;

  @IsOptional() @IsString() @MaxLength(2) stateCode?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  paymentTermsDays?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  creditLimit?: number;

  @IsOptional() @IsBoolean() isGstRegistered?: boolean;
}
