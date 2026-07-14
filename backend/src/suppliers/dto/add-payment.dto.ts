import { IsString, IsNotEmpty, IsOptional, IsDateString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddPaymentDto {
  @IsOptional() @IsString() purchaseId?: string;
  @IsOptional() @IsString() invoiceReference?: string;
  @IsOptional() @IsDateString() paymentDate?: string;

  @Type(() => Number) @IsNumber() @Min(0.01)
  amount: number;

  @IsString() @IsNotEmpty() paymentMode: string;

  @IsOptional() @IsString() referenceNumber?: string;
  @IsOptional() @IsString() notes?: string;
}
