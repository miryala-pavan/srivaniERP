import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateBankAccountDto {
  @IsOptional() @IsString() accountName?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() ifscCode?: string;
  @IsOptional() @IsString() branchName?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
