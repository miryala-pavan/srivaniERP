import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { ShopCacheService } from './shop-cache.service';

@Module({
  controllers: [ShopController],
  providers: [ShopCacheService, ShopService],
})
export class ShopModule {}
