import { IsString, IsOptional, IsDateString, IsNumber, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOpeningBalanceDto {
  @Type(() => Number) @IsNumber() @Min(0)
  openingBalance: number;

  @IsString() @IsIn(['DEBIT', 'CREDIT'])
  openingBalanceType: string;

  @IsOptional() @IsDateString() openingBalanceDate?: string;
  @IsOptional() @IsString() openingBalanceNote?: string;
}
