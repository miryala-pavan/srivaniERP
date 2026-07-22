import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AddOrderItemDto {
  @IsString()
  @IsNotEmpty()
  pluBarcode: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;
}

export class UpdateOrderItemQtyDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  quantity: number;
}
