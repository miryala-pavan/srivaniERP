import { IsArray, ArrayMinSize, ArrayMaxSize, IsString, IsOptional } from 'class-validator';

export class BulkSendTemplateDto {
  // Capped at 200 — this runs as a sequential await loop within one HTTP
  // request (same characteristic sendCampaign already has for a segment,
  // just now bounded since this is staff-triggered from a live request
  // rather than an admin-run broadcast).
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsString({ each: true })
  ids: string[];

  @IsString()
  template: string;

  @IsString()
  language: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  params?: string[];
}
