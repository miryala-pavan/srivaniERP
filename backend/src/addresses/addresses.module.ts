import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { PrismaModule } from '../prisma/prisma.module';
import { StorefrontAuthModule } from '../storefront-auth/storefront-auth.module';

@Module({
  imports: [PrismaModule, StorefrontAuthModule],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
