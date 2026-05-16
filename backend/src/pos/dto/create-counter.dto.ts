import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCounterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}
