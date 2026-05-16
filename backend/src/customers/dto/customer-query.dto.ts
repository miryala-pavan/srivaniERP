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
}
