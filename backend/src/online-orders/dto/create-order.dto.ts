import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
  MinLength,
  MaxLength,
  Matches,
  IsEmail,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DeliveryType {
  HOME_DELIVERY = 'HOME_DELIVERY',
  STORE_PICKUP = 'STORE_PICKUP',
}

export enum PaymentMethod {
  RAZORPAY = 'RAZORPAY',
  COD = 'COD',
}

class DeliveryAddressDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  line1: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'pincode must be a 6-digit number' })
  pincode: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;
}

class OrderItemDto {
  @IsString()
  pluBarcode: string;

  @IsString()
  productCode: string;

  @IsString()
  productName: string;

  @IsString()
  packLabel: string;

  @IsNumber()
  @Min(1)
  @Max(999)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mrp?: number;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  customerName: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  customerPhone: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsEnum(DeliveryType)
  deliveryType: DeliveryType;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @IsOptional()
  @IsString()
  deliverySlot?: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNotes?: string;
}
