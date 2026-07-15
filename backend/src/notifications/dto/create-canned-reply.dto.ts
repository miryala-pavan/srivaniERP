import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCannedReplyDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  title: string;

  @IsString() @IsNotEmpty() @MaxLength(1000)
  body: string;

  @IsOptional() @IsString() @MaxLength(50)
  category?: string;
}
