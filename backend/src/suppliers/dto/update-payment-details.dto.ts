import { IsString, IsOptional, IsDateString } from 'class-validator';

export class UpdatePaymentDetailsDto {
  @IsOptional() @IsDateString() paymentDate?: string;
  @IsOptional() @IsString() paymentMode?: string;
  @IsOptional() @IsString() referenceNumber?: string | null;
  @IsOptional() @IsString() utrNumber?: string | null;
  @IsOptional() @IsString() epayOrderNumber?: string | null;
  @IsOptional() @IsString() adjustmentReason?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsString() screenshotUrl?: string | null;
}
