import { IsString, IsNotEmpty, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(6)
  code: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  label: string;

  @IsOptional() @IsString()
  parentId?: string;

  @IsOptional() @IsString()
  hsnCode?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sortOrder?: number;
}
