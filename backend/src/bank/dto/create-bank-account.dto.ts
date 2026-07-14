import { IsString, IsNotEmpty, IsOptional, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const BANK_ACCOUNT_TYPES = ['CURRENT', 'SAVINGS', 'CC', 'OD'] as const;

export class CreateBankAccountDto {
  @IsString() @IsNotEmpty() accountName: string;
  @IsString() @IsNotEmpty() bankName: string;
  @IsString() @IsNotEmpty() accountNumber: string;

  @IsOptional() @IsString() @IsIn(BANK_ACCOUNT_TYPES)
  accountType?: string;

  @IsOptional() @IsString() ifscCode?: string;
  @IsOptional() @IsString() branchName?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  openingBalance?: number;
}
