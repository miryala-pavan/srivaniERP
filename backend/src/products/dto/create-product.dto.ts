import {
  IsString, IsNotEmpty, IsNumber, IsOptional, IsBoolean, IsPositive, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() shortName?: string;
  @IsString() @IsNotEmpty() hsnCode: string;
  @IsString() @IsNotEmpty() taxId: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @IsString() unitOfMeasure?: string;
  @IsOptional() @IsString() productType?: string;

  @Type(() => Number) @IsNumber() @IsPositive() mrp: number;
  @Type(() => Number) @IsNumber() @IsPositive() sellingPrice: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) costPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gstRatePercent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) reorderLevel?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minimumStockLevel?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) reorderQuantity?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maximumStockLevel?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minSellingQty?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) moqFromSupplier?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) leadTimeDays?: number;

  @IsOptional() @IsBoolean() allowDecimalQty?: boolean;
  @IsOptional() @IsBoolean() allowNegativeStock?: boolean;
  @IsOptional() @IsBoolean() isForSale?: boolean;
  @IsOptional() @IsBoolean() isForPurchase?: boolean;
  @IsOptional() @IsBoolean() isRepackingItem?: boolean;
  @IsOptional() @IsBoolean() isPerishable?: boolean;
  @IsOptional() @IsBoolean() expiryTracking?: boolean;
  @IsOptional() @IsBoolean() availableOnline?: boolean;

  @IsOptional() @IsString() aisle?: string;
  @IsOptional() @IsString() rackNumber?: string;
  @IsOptional() @IsString() shelfPosition?: string;
  @IsOptional() @IsString() preferredSupplierId?: string;
  @IsOptional() @IsString() imageUrl?: string;

  // Return policy
  @IsOptional() @IsBoolean() isReturnable?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) returnPeriodDays?: number;
  @IsOptional() @IsString() nonReturnableReason?: string;

  // New fields
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) defaultPackSize?: number;
  @IsOptional() @IsString() brandName?: string;
  @IsOptional() @IsString() purchaseUnit?: string;
  @IsOptional() @IsString() stockUnit?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cessRate?: number;
}
