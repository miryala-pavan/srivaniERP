import { Module } from '@nestjs/common';
import { OnlineOrdersController } from './online-orders.controller';
import { OnlineOrdersService } from './online-orders.service';
import { WaOrderingService } from './wa-ordering.service';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ServiceablePincodesModule } from '../serviceable-pincodes/serviceable-pincodes.module';
import { WalletModule } from '../wallet/wallet.module';
import { ShopModule } from '../shop/shop.module';
import { StorefrontAuthModule } from '../storefront-auth/storefront-auth.module';

@Module({
  imports: [EventsModule, AuditLogModule, NotificationsModule, ServiceablePincodesModule, WalletModule, ShopModule, StorefrontAuthModule],
  controllers: [OnlineOrdersController],
  providers: [OnlineOrdersService, WaOrderingService],
  exports: [OnlineOrdersService, WaOrderingService],
})
export class OnlineOrdersModule {}
