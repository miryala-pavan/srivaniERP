import { Module } from '@nestjs/common';
import { GrnService } from './grn.service';
import { GrnController } from './grn.controller';
import { GrnCalculationsService } from './grn-calculations.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [NotificationsModule, SuppliersModule, EventsModule],
  providers: [GrnService, GrnCalculationsService],
  controllers: [GrnController],
})
export class GrnModule {}
