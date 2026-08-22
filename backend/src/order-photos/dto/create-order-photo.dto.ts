import { IsString, IsOptional } from 'class-validator';

export class CreateOrderPhotoDto {
  @IsString()
  customerId: string;

  @IsOptional() @IsString()
  salesBillId?: string;

  @IsOptional() @IsString()
  onlineOrderId?: string;

  @IsOptional() @IsString()
  caption?: string;
}
