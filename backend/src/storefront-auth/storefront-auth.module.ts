import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorefrontAuthService } from './storefront-auth.service';
import { StorefrontAuthController } from './storefront-auth.controller';
import { StorefrontJwtGuard } from './guards/storefront-jwt.guard';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    // Deliberately a separate JwtModule instance/secret from AuthModule's —
    // a leaked storefront customer token must never be replayable against
    // ERP staff routes, or vice versa.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('STOREFRONT_JWT_SECRET'),
        signOptions: { expiresIn: (process.env.STOREFRONT_JWT_EXPIRES_IN || '7d') as any },
      }),
    }),
  ],
  controllers: [StorefrontAuthController],
  providers: [StorefrontAuthService, StorefrontJwtGuard],
  exports: [JwtModule, StorefrontJwtGuard],
})
export class StorefrontAuthModule {}
