import { IsString, MinLength } from 'class-validator';

export class VoidBillDto {
  @IsString()
  @MinLength(10, { message: 'Void reason must be at least 10 characters' })
  reason: string;
}
