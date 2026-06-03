import { IsOptional, IsString, IsInt, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ProductQueryDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 20;

  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() subCategoryId?: string;
  @IsOptional() @IsString() brandId?: string;
  @IsOptional() @IsString() productType?: string;
  @IsOptional() @IsString() status?: string;     // ACTIVE | DISABLED | OUT_OF_STOCK
  @IsOptional() @IsString() stockStatus?: string; // IN_STOCK | LOW_STOCK | OUT_OF_STOCK
  @IsOptional() @Type(() => Number) @IsNumber() gstRate?: number;
  @IsOptional() @IsString() sortBy?: string;     // name | code | sellingPrice | createdAt
  @IsOptional() @IsString() sortOrder?: string;  // asc | desc
  @IsOptional() @IsString() hsnCode?: string;    // filter by exact HSN or "UNSET" for 0000

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeInactive?: boolean;
}
