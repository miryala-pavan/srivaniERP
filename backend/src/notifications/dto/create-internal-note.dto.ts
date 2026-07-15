import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateInternalNoteDto {
  @IsString() @IsNotEmpty() @MaxLength(2000)
  body: string;
}
