import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CreateCustomerDto } from './create-customer.dto';

export enum CustomerStatusDto {
  ACTIVE   = 'ACTIVE',
  BLOCKED  = 'BLOCKED',
  INACTIVE = 'INACTIVE',
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional()
  @IsEnum(CustomerStatusDto)
  status?: CustomerStatusDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
