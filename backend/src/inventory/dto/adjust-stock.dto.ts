import {
  IsString, IsNotEmpty, IsOptional, IsNumber,
  IsEnum, IsNotIn, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AdjustmentType {
  DAMAGE      = 'DAMAGE',
  LOSS        = 'LOSS',
  FOUND       = 'FOUND',
  EXPIRY      = 'EXPIRY',
  RECOUNT     = 'RECOUNT',
}

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsNotIn([0], { message: 'adjustedQuantity cannot be zero' })
  adjustedQuantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsEnum(AdjustmentType)
  type?: AdjustmentType;
}
