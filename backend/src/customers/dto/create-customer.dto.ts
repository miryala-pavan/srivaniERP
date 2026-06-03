import {
  IsString, IsNotEmpty, IsOptional, IsEmail,
  IsEnum, Matches, MaxLength, IsBoolean,
  IsNumber, IsDateString, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CustomerChannelDto {
  POS    = 'POS',
  ONLINE = 'ONLINE',
  BOTH   = 'BOTH',
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
  @IsString()
  customerType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  companyName?: string;

  @IsOptional()
  @IsString()
  billingAddress?: string;

  @IsOptional()
  @IsEnum(CustomerChannelDto)
  channel?: CustomerChannelDto;

  @IsOptional()
  @IsString()
  customerGroup?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  openingBalance?: number;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString()
  anniversary?: string;

  @IsOptional()
  @IsDateString()
  consentGivenAt?: string;
}
