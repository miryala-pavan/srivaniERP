import { IsString, IsNotEmpty, IsOptional, Matches, IsEmail, IsIn } from 'class-validator';

const ALLOWED_ROLES = [
  'BRANCH_MANAGER', 'CASHIER', 'PURCHASE_CHECKER',
  'ACCOUNTS_PERSON', 'FLOOR_SUPERVISOR', 'PACKING_STAFF', 'SALES_REP', 'VIEWER',
];

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
