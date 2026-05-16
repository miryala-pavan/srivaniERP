import { Module } from '@nestjs/common';
import { DayClosureService } from './day-closure.service';
import { DayClosureController } from './day-closure.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [DayClosureService],
  controllers: [DayClosureController],
})
export class DayClosureModule {}
