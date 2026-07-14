import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, Min,
  ValidateNested, ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseOrderItemDto {
  @IsString() @IsNotEmpty() productId: string;
  @IsString() @IsNotEmpty() productName: string;
  @IsOptional() @IsString() pluCode?: string;

  @Type(() => Number) @IsNumber() @Min(0.001)
  qtyOrdered: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  unitCost?: number;

  @IsOptional() @IsString() notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsString() @IsNotEmpty() supplierId: string;

  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  @ArrayNotEmpty()
  items: PurchaseOrderItemDto[];

  @IsOptional() @IsDateString() expectedDate?: string;
  @IsOptional() @IsString() notes?: string;
}
