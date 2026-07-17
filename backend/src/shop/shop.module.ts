import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { ShopCacheModule } from './shop-cache.module';
import { ServiceablePincodesModule } from '../serviceable-pincodes/serviceable-pincodes.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [ShopCacheModule, ServiceablePincodesModule, SettingsModule],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
