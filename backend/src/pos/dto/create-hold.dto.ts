import { Type } from 'class-transformer';
import {
  IsString, IsBoolean, IsNumber, IsOptional,
  IsArray, ValidateNested, Min, Max, ArrayMinSize,
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
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
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
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => HoldItemDto)
  items: HoldItemDto[];

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  grandTotal: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  itemCount: number;

  @IsString()
  @IsOptional()
  counterName?: string;
}
