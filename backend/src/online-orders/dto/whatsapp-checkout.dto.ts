import {
  IsString, IsOptional, IsArray, IsNumber, IsEmail, IsEnum, ValidateIf,
  ValidateNested, Matches, MinLength, MaxLength, Min, Max, ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryType } from './create-order.dto';

class WaItemDto {
  @IsString() pluBarcode: string;
  @IsString() productCode: string;
  @IsString() productName: string;
  @IsString() packLabel: string;
  @IsNumber() @Min(1) @Max(999) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
  @IsOptional() @IsNumber() mrp?: number;
}

class WaDeliveryAddressDto {
  @IsString() @MinLength(5) @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @MaxLength(100) city: string;
  @IsString() @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit number' }) pincode: string;
  @IsOptional() @IsString() @MaxLength(100) state?: string;
}

export class WhatsAppCheckoutDto {
  @IsString() @MinLength(2) customerName: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  customerPhone: string;

  @IsOptional() @IsEmail() customerEmail?: string;

  @IsEnum(DeliveryType) deliveryType: DeliveryType;

  @ValidateIf(o => o.deliveryType === DeliveryType.HOME_DELIVERY)
  @ValidateNested()
  @Type(() => WaDeliveryAddressDto)
  deliveryAddress?: WaDeliveryAddressDto;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => WaItemDto)
  items: WaItemDto[];

  @IsOptional() @IsString() @MaxLength(500) customerNotes?: string;
}
