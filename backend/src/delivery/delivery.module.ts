import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';
import { GeocodingModule } from '../geocoding/geocoding.module';

import { DeliveryBoyAuthService } from './delivery-boy-auth.service';
import { DeliveryBoyJwtGuard } from './guards/delivery-boy-jwt.guard';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliveryDispatchService } from './delivery-dispatch.service';
import { DeliveryEscalationService } from './delivery-escalation.service';
import { DeliveryPhotoCleanupService } from './delivery-photo-cleanup.service';
import { DeliveryPhotoService } from './delivery-photo.service';
import { DeliveryBoyService } from './delivery-boy.service';

import { RiderAuthController } from './rider-auth.controller';
import { RiderController } from './rider.controller';
import { DeliveryController } from './delivery.controller';
import { DeliveryBoyController } from './delivery-boy.controller';
import { TrackController } from './track.controller';
import { DeliverySettingsController } from './delivery-settings.controller';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    EventsModule,
    GeocodingModule,
    // Deliberately a separate JwtModule instance/secret from AuthModule's and
    // StorefrontAuthModule's — a leaked rider token must never be replayable
    // against ERP staff routes or storefront customer routes, or vice versa.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('RIDER_JWT_SECRET'),
        signOptions: { expiresIn: (process.env.RIDER_JWT_EXPIRES_IN || '30d') as any },
      }),
    }),
  ],
  controllers: [RiderAuthController, RiderController, DeliveryController, DeliveryBoyController, TrackController, DeliverySettingsController],
  providers: [
    DeliveryBoyAuthService,
    DeliveryBoyJwtGuard,
    DeliverySettingsService,
    DeliveryDispatchService,
    DeliveryEscalationService,
    DeliveryPhotoCleanupService,
    DeliveryPhotoService,
    DeliveryBoyService,
  ],
  exports: [JwtModule, DeliveryDispatchService, DeliverySettingsService],
})
export class DeliveryModule {}
