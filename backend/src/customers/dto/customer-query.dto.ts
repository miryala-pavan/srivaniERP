import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class CustomerQueryDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  customerType?: string;

  @IsOptional()
  @IsString()
  customerGroup?: string;

  @IsOptional()
  @IsString()
  whatsappOptIn?: string;

  @IsOptional()
  @IsString()
  sort?: string; // name_asc | name_desc | code_asc | code_desc | phone_asc | phone_desc | created_asc | created_desc
}
