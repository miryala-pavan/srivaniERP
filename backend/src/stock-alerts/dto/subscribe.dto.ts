import { IsString, IsOptional, IsEmail, IsPhoneNumber, MinLength } from 'class-validator';

export class SubscribeStockAlertDto {
  @IsString()
  @MinLength(3)
  pluBarcode: string;

  @IsString()
  @MinLength(2)
  productName: string;

  @IsString()
  @MinLength(1)
  packLabel: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
