import {
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  Matches,
} from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' })
  phone: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @MinLength(5, { message: 'Address line 1 must be at least 5 characters' })
  line1: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  @MinLength(2)
  city: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit number' })
  pincode: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
