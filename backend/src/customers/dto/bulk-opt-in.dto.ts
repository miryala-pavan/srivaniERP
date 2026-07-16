import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkOptInFilterDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  whatsappOptIn?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  customerGroup?: string;
}

export class BulkOptInDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ids?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => BulkOptInFilterDto)
  filter?: BulkOptInFilterDto;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;
}
