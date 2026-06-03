import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';

export class CreateCustomerAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsString() @MinLength(1) line1: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsString() @MinLength(1) line1?: string;
  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
