import { IsArray, ArrayMinSize, ArrayMaxSize, IsString } from 'class-validator';

export class BulkSendHistoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  customerIds: string[];
}
