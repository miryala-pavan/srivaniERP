import {
  IsString, IsNotEmpty, IsOptional, IsArray, IsNumber,
  Min, ValidateNested, ArrayMinSize, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreditNoteItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;
}

export class CreateCreditNoteDto {
  @IsString()
  @IsNotEmpty()
  originalBillId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items: CreditNoteItemDto[];

  @IsIn(['CASH', 'STORE_CREDIT'])
  refundMode: string;
}
