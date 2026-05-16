import { IsOptional, IsString } from 'class-validator';

export class StockQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
