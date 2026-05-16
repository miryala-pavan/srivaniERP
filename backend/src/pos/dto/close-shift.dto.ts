import { IsNumber, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CloseShiftDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  closingCash: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
