import { IsString, IsOptional, IsEmail, IsIn, Matches } from 'class-validator';

const ALLOWED_ROLES = [
  'BRANCH_MANAGER', 'CASHIER', 'PURCHASE_CHECKER',
  'ACCOUNTS_PERSON', 'FLOOR_SUPERVISOR', 'PACKING_STAFF', 'SALES_REP', 'VIEWER',
];

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
