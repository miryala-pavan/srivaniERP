import { IsString, IsOptional, IsEmail, IsIn, Matches } from 'class-validator';
import { UserRole } from '@prisma/client';

const ALLOWED_ROLES = Object.values(UserRole).filter(r => r !== UserRole.SUPER_ADMIN);

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_ROLES, { message: 'Invalid role' })
  role?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  counterId?: string;
}

export class ResetPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  newPin: string;
}
