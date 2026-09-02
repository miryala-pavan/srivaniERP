import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';

@Module({
  imports: [JwtModule, ConfigModule, PrismaModule],
  providers: [EventsGateway, EventsService],
  exports: [EventsService],
})
export class EventsModule {}
