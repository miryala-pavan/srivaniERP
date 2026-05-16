import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { ProductsModule } from '../products/products.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ProductsModule, NotificationsModule],
  providers: [PosService],
  controllers: [PosController],
})
export class PosModule {}
