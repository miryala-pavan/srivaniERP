import {
  IsString, IsNotEmpty, IsOptional, IsEmail,
  IsEnum, Matches, MaxLength,
} from 'class-validator';

export enum CustomerType {
  REGULAR = 'REGULAR',
  WALKIN  = 'WALKIN',
}

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'gstin must be a valid 15-character GST number',
  })
  gstin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;
}
