import { IsString, IsOptional, Matches, IsEmail, IsDateString } from 'class-validator';

export class UpdateBusinessDto {
  @IsString() @IsOptional()
  name?: string;

  @IsString() @IsOptional()
  @Matches(/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/, {
    message: 'GSTIN must be a valid 15-character GST Identification Number',
  })
  gstin?: string;

  @IsString() @IsOptional()
  @Matches(/^\d{2}$/, { message: 'State code must be exactly 2 digits' })
  stateCode?: string;

  @IsString() @IsOptional()
  stateName?: string;

  @IsString() @IsOptional()
  address?: string;

  @IsString() @IsOptional()
  phone?: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  // Tax IDs
  @IsString() @IsOptional()
  @Matches(/^[A-Z]{5}\d{4}[A-Z]$/, { message: 'PAN must be in format AAAAA0000A' })
  pan?: string;

  @IsString() @IsOptional()
  @Matches(/^[A-Z]{4}\d{5}[A-Z]$/, { message: 'TAN must be in format AAAA00000A' })
  tan?: string;

  @IsString() @IsOptional()
  professionalTaxNo?: string;

  // Food & Health
  @IsString() @IsOptional()
  @Matches(/^\d{14}$/, { message: 'FSSAI license must be exactly 14 digits' })
  fssaiLicense?: string;

  @IsDateString() @IsOptional()
  fssaiExpiry?: string;

  @IsString() @IsOptional()
  drugLicense?: string;

  @IsDateString() @IsOptional()
  drugLicenseExpiry?: string;

  // Trade & Premises
  @IsString() @IsOptional()
  tradeLicense?: string;

  @IsDateString() @IsOptional()
  tradeLicenseExpiry?: string;

  @IsString() @IsOptional()
  shopEstablishmentLicense?: string;

  @IsDateString() @IsOptional()
  shopEstablishmentExpiry?: string;

  @IsString() @IsOptional()
  fireSafetyNoc?: string;

  @IsDateString() @IsOptional()
  fireSafetyNocExpiry?: string;

  // Operational
  @IsString() @IsOptional()
  weightsAndMeasuresLicense?: string;

  @IsDateString() @IsOptional()
  weightsAndMeasuresExpiry?: string;

  @IsString() @IsOptional()
  liquorLicense?: string;

  @IsDateString() @IsOptional()
  liquorLicenseExpiry?: string;

  // Other Registrations
  @IsString() @IsOptional()
  udyamRegistration?: string;

  @IsString() @IsOptional()
  @Matches(/^[LUu]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, {
    message: 'CIN must be 21 characters in standard format (e.g. L17110MH1973PLC019786)',
  })
  cin?: string;

  @IsString() @IsOptional()
  @Matches(/^\d{10}$/, { message: 'IEC code must be exactly 10 digits' })
  iecCode?: string;
}
