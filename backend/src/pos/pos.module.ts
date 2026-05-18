import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [ProductsModule, NotificationsModule, EventsModule],
  providers: [PosService],
  controllers: [PosController],
})
export class PosModule {}
