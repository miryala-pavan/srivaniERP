import { IsOptional, IsDateString, IsString } from 'class-validator';

export class CashSummaryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
