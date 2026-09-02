import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class UpdateDeliveryBoyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone?: string;

  @IsOptional()
  @IsString()
  vehicleType?: string;

  @IsOptional()
  @IsString()
  vehicleNumber?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
