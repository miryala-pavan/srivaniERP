import { IsString, IsOptional, IsBoolean, MinLength, Matches } from 'class-validator';

export class UpdateAddressDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @MinLength(5)
  @IsOptional()
  line1?: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  @MinLength(2)
  @IsOptional()
  city?: string;

  @IsString()
  @Matches(/^\d{6}$/)
  @IsOptional()
  pincode?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
