import { IsString, IsInt, Min, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class CreateReminderRuleDto {
  @IsString()
  name: string;

  @IsIn(['PAYMENT_OVERDUE', 'REORDER_DUE'])
  triggerType: 'PAYMENT_OVERDUE' | 'REORDER_DUE';

  @IsInt() @Min(1)
  thresholdDays: number;

  @IsOptional() @IsInt() @Min(1)
  cooldownDays?: number;
}

export class UpdateReminderRuleDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsInt() @Min(1)
  thresholdDays?: number;

  @IsOptional() @IsInt() @Min(1)
  cooldownDays?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
