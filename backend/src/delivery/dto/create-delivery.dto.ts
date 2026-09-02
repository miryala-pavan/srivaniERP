import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateDeliveryDto {
  // Either customerId (an existing Customer row — the normal case for a
  // storefront order) OR customerName+customerPhone (resolved-or-created —
  // OnlineOrder has no customerId FK, and staff creating a delivery for a
  // phone/WhatsApp order won't have one either). See createDelivery's
  // resolveOrCreateCustomer for the matching logic.
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  salesBillId?: string;

  @IsOptional()
  @IsString()
  onlineOrderId?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  deliveryLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  deliveryLng: number;

  @IsOptional()
  @IsString()
  deliveryAddressText?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;
}
