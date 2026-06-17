import { Module } from '@nestjs/common';
import { StorefrontProfileController } from './storefront-profile.controller';
import { StorefrontProfileService } from './storefront-profile.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StorefrontProfileController],
  providers: [StorefrontProfileService],
})
export class StorefrontProfileModule {}
