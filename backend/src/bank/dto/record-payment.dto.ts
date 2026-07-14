import {
  IsString, IsNotEmpty, IsOptional, IsDateString, IsArray, ArrayNotEmpty,
  IsNumber, Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordPaymentDto {
  @IsString() @IsNotEmpty() supplierId: string;

  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  purchaseIds: string[];

  @IsArray() @ArrayNotEmpty() @Type(() => Number) @IsNumber({}, { each: true }) @Min(0, { each: true })
  amounts: number[];

  @IsDateString() paymentDate: string;
  @IsString() @IsNotEmpty() paymentMode: string;

  @IsOptional() @IsString() referenceNumber?: string;
  @IsOptional() @IsString() utrNumber?: string;
  @IsOptional() @IsString() bankAccountId?: string;
  @IsOptional() @IsString() notes?: string;
}
