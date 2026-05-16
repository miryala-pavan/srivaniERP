import { Type } from 'class-transformer';
import {
  IsString, IsBoolean, IsNumber, IsOptional,
  IsArray, ValidateNested, Min,
} from 'class-validator';

export class HoldItemDto {
  @IsString()
  productId: string;

  @IsString()
  taxId: string;

  @IsString()
  productName: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  mrp?: number;

  @IsString()
  @IsOptional()
  unitOfMeasure?: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Type(() => Number)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discountPercent?: number;

  @IsNumber()
  @Type(() => Number)
  gstRatePercent: number;

  @IsNumber()
  @Type(() => Number)
  totalAmount: number;
}

export class CreateHoldDto {
  @IsString()
  @IsOptional()
  billType?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerGstin?: string;

  @IsBoolean()
  @IsOptional()
  isB2B?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HoldItemDto)
  items: HoldItemDto[];

  @IsNumber()
  @Type(() => Number)
  subtotal: number;

  @IsNumber()
  @Type(() => Number)
  grandTotal: number;

  @IsNumber()
  @Type(() => Number)
  itemCount: number;

  @IsString()
  @IsOptional()
  counterName?: string;
}
