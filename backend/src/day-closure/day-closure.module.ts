import { Module } from '@nestjs/common';
import { DayClosureService } from './day-closure.service';
import { DayClosureController } from './day-closure.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [NotificationsModule, EventsModule],
  providers: [DayClosureService],
  controllers: [DayClosureController],
})
export class DayClosureModule {}
