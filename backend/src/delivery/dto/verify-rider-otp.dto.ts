import { IsString, Matches } from 'class-validator';

export class VerifyRiderOtpDto {
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Enter a valid 10-digit Indian mobile number' })
  phone: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code' })
  code: string;
}
