import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StockTakeItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;
}

export class StockTakeDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  sessionName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTakeItemDto)
  items: StockTakeItemDto[];
}
