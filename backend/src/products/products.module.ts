import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductGroupsService } from './product-groups.service';
import { ProductGroupsController } from './product-groups.controller';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [EventsModule, AuditLogModule],
  providers: [ProductsService, ProductGroupsService],
  controllers: [ProductsController, ProductGroupsController],
  exports: [ProductsService],
})
export class ProductsModule {}
