import { IsString, Matches, IsOptional } from 'class-validator';

export class AddPincodeDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'pincode must be exactly 6 digits' })
  pincode: string;

  @IsOptional() @IsString()
  areaLabel?: string;
}
