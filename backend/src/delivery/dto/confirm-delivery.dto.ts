import { IsString, IsOptional, IsBoolean, IsArray, Matches, ArrayMinSize } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Enter the 4-digit delivery OTP' })
  otpCode: string;

  // Required only when the delivery has a codAmount — enforced in the service,
  // not here, since whether it's required depends on the Delivery row itself.
  @IsOptional()
  @IsBoolean()
  cashCollected?: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one delivery photo is required' })
  @IsString({ each: true })
  photoIds: string[];
}
