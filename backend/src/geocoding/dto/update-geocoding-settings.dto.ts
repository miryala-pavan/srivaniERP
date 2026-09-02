import { IsString, IsOptional, MinLength } from 'class-validator';

export class UpdateGeocodingSettingsDto {
  @IsString()
  @IsOptional()
  @MinLength(10)
  googlePlacesApiKey?: string;
}
