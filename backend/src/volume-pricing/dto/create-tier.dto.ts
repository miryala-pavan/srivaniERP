import { IsString, IsInt, IsNumber, Min, MinLength } from 'class-validator';

export class CreateVolumeTierDto {
  @IsString() @MinLength(1) pluBarcode: string;
  @IsInt() @Min(2) minQty: number;
  @IsNumber() @Min(0.01) price: number;
}
