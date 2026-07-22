import { IsNumber, IsPositive, IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class WalletAdjustDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  relatedType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  relatedId?: string;
}
