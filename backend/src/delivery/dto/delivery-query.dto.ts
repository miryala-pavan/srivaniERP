import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';

export class DeliveryQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['BROADCASTING', 'ASSIGNED', 'DELIVERED', 'FAILED', 'CANCELLED']) status?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsIn(['date', 'status', 'customer']) sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
  @IsOptional() @IsString() onlineOrderId?: string;
}
