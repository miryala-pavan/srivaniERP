import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator';

export class CreateCommentCampaignDto {
  @IsIn(['FACEBOOK', 'INSTAGRAM'])
  channel: 'FACEBOOK' | 'INSTAGRAM';

  @IsOptional() @IsString() @MaxLength(100)
  postId?: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  triggerKeyword: string;

  @IsString() @IsNotEmpty() @MaxLength(1000)
  replyMessage: string;
}
