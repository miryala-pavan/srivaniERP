import { IsOptional, IsString } from 'class-validator';

export class SupplierQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() isActive?: string;
  @IsOptional() @IsString() supplierType?: string;
}
