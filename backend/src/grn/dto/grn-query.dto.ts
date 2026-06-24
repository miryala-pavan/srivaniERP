import { IsOptional, IsString } from 'class-validator';

export class GrnQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsString() excludeStatus?: string;

  // Free-text: matches grnNumber / invoiceNumber / supplierName
  @IsOptional() @IsString() search?: string;
  // grandTotal range
  @IsOptional() @IsString() minAmount?: string;
  @IsOptional() @IsString() maxAmount?: string;
  // PAID | PARTIAL | UNPAID (approved GRNs only)
  @IsOptional() @IsString() paymentStatus?: string;
  // date | amount | supplier | grnNumber | invoiceNumber
  @IsOptional() @IsString() sortBy?: string;
  // asc | desc
  @IsOptional() @IsString() sortDir?: string;
}
