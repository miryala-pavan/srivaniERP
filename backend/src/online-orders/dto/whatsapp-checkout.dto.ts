import {
  IsString, IsOptional, IsArray, IsNumber, IsEmail,
  ValidateNested, Matches, MinLength, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class WaItemDto {
  @IsString() pluBarcode: string;
  @IsString() productCode: string;
  @IsString() productName: string;
  @IsString() packLabel: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsNumber() mrp?: number;
}

export class WhatsAppCheckoutDto {
  @IsString() @MinLength(2) customerName: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  customerPhone: string;

  @IsOptional() @IsEmail() customerEmail?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WaItemDto)
  items: WaItemDto[];

  @IsOptional() @IsString() customerNotes?: string;
}
