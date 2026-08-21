import { IsArray, ArrayMaxSize, IsString, IsOptional, IsISO8601 } from 'class-validator';

export class ScheduleCampaignDto {
  @IsString()
  name: string;

  // 'ALL_OPTED_IN' | 'WIN_BACK_30D' | 'CUSTOM_LIST'
  @IsString()
  segmentId: string;

  // Only used when segmentId === 'CUSTOM_LIST'
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true })
  customerIds?: string[];

  @IsString()
  template: string;

  @IsString()
  language: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  params?: string[];

  @IsISO8601()
  scheduledAt: string;
}
