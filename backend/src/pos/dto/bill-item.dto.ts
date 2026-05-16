import { IsString, IsNotEmpty, IsNumber, IsPositive, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BillItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  taxId: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  unitPrice: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  discountPercent?: number;

  // Price override fields
  @IsBoolean()
  @IsOptional()
  isPriceOverridden?: boolean;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  originalPrice?: number;

  @IsString()
  @IsOptional()
  overrideReason?: string;
}
