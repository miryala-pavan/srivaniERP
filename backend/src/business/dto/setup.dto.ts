import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SetupDto {
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @IsString()
  @IsOptional()
  gstin?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  stateCode?: string;

  @IsString()
  @IsOptional()
  stateName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fssaiLicense?: string;
}
