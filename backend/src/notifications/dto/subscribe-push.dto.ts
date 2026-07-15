import { IsString, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PushKeysDto {
  @IsString() @IsNotEmpty() p256dh: string;
  @IsString() @IsNotEmpty() auth: string;
}

export class SubscribePushDto {
  @IsString() @IsNotEmpty() endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;
}
