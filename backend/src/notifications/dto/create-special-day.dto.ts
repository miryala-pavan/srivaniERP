import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateSpecialDayDto {
  @IsDateString()
  date: string;

  @IsString() @MinLength(1)
  label: string;

  @IsString() @MinLength(1)
  message: string;
}
