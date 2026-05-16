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
}
