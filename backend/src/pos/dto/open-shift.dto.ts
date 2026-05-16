import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenShiftDto {
  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  openingCash: number;
}
