import { IsString, IsNotEmpty, IsOptional, Matches, IsEmail, IsIn } from 'class-validator';
import { UserRole } from '@prisma/client';

// Derived from Prisma enum — any new role added to schema.prisma is automatically valid here
const ALLOWED_ROLES = Object.values(UserRole).filter(r => r !== UserRole.SUPER_ADMIN);

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  pin: string;

  @IsString()
  @IsIn(ALLOWED_ROLES, { message: 'Invalid role' })
  role: string;

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
