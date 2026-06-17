import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillItemDto } from './bill-item.dto';

export enum PaymentModeEnum {
  CASH   = 'CASH',
  UPI    = 'UPI',
  CARD   = 'CARD',
  CHEQUE = 'CHEQUE',
  SPLIT  = 'SPLIT',
}

export class CreateBillDto {
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsString()
  @IsNotEmpty()
  counterId: string;

  @IsEnum(PaymentModeEnum)
  paymentMode: PaymentModeEnum;

  // Split payment breakdown (required when paymentMode=SPLIT)
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cashAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  upiAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  cardAmount?: number;

  // Override paid amount (for credit / partial payment)
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  paidAmount?: number;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  // GSTIN: 15-char format per GST Act
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, {
    message: 'Invalid GSTIN format (expected: 22AAAAA0000A1Z5)',
  })
  customerGstin?: string;

  // Override supply state (defaults to customer GSTIN prefix or business state)
  @IsString()
  @IsOptional()
  supplyStateCode?: string;

  @IsString()
  @IsOptional()
  billType?: string; // TAX_INVOICE | RETAIL_INVOICE | ESTIMATE

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  estimateValidityDays?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  loyaltyPointsRedeemed?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BillItemDto)
  items: BillItemDto[];
}
