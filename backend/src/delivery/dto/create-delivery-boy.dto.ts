import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateDeliveryBoyDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;
}
