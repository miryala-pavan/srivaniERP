import { IsString, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSupplierBankAccountDto {
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsString() ifscCode?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) transferLimit?: number;
  @IsOptional() @IsString() notes?: string;
}
