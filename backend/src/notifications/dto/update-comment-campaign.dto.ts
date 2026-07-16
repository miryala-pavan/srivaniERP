import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateCommentCampaignDto {
  @IsOptional() @IsString() @MaxLength(100)
  postId?: string | null;

  @IsOptional() @IsString() @MaxLength(100)
  triggerKeyword?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  replyMessage?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
