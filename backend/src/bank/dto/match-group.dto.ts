import { IsString, IsOptional, IsArray, ArrayNotEmpty } from 'class-validator';

export class MatchGroupDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  bankTransactionIds: string[];

  @IsArray() @ArrayNotEmpty() @IsString({ each: true })
  grnIds: string[];

  @IsOptional() @IsString() adjustmentReason?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}
