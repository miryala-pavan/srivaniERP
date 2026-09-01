import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateHistoricalBillDto } from './create-historical-bill.dto';

export class CreateHistoricalBillsBulkDto {
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateHistoricalBillDto)
  bills: CreateHistoricalBillDto[];
}
