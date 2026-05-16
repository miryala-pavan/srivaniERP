import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFeaturesDto {
  @IsOptional()
  @IsBoolean()
  smartCartEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  onlineOrdersEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPOEnabled?: boolean;
}
