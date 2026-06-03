import { IsString, IsNotEmpty, IsOptional, Matches, MaxLength } from 'class-validator';

export class PosQuickAddCustomerDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, { message: 'phone must be a valid 10-digit Indian mobile number' })
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
