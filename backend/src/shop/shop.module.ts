import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { ShopCacheModule } from './shop-cache.module';

@Module({
  imports: [ShopCacheModule],
  controllers: [ShopController],
  providers: [ShopService],
})
export class ShopModule {}
