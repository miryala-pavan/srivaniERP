import {
  IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsDateString, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GrnItemDto {
  @IsString() @IsNotEmpty() productId: string;
  @IsOptional() @IsString() pluCode?: string;
  @IsOptional() @IsString() supplierProductName?: string;

  @Type(() => Number) @IsNumber() @Min(0) basicCostPrice: number;
  // Whole line received free (a different product given as a scheme freebie),
  // distinct from freeCases/freeLoose below (extra free units of this same item).
  @IsOptional() @IsBoolean() isFreeItem?: boolean;
  // Only meaningful when isFreeItem=true: false = not for resale (sample/display item).
  @IsOptional() @IsBoolean() isSaleable?: boolean;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) casesReceived?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) looseQty?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) packSize?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freeCases?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) freeLoose?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) disc1Percent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) disc2Percent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) disc3Percent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) disc4Percent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cashDiscPercent?: number;

  @Type(() => Number) @IsNumber() @Min(0) mrp: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) sellingPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) cessRate?: number;
  // Frontend sends the GST rate the user selected; backend uses this when provided
  // so backend calculation matches exactly what the user sees.
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) gstRatePercent?: number;

  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsDateString() manufacturingDate?: string;

  // Unit-of-measure info for the receiving PLU (e.g. WEIGHT/kg/50) — optional, captured
  // inline at GRN entry when the matched PLU doesn't already have it set.
  @IsOptional() @IsString() measureType?: string;
  @IsOptional() @IsString() unitSymbol?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) unitSize?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) baseUnitQty?: number;
  @IsOptional() @IsString() gstUqc?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) rejectedQty?: number;
  @IsOptional() @IsString() rejectionReason?: string;
  @IsOptional() @IsString() rejectionAction?: string;
  @IsOptional() @IsString() notes?: string;
}
