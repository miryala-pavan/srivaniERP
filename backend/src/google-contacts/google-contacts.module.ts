import { Module } from '@nestjs/common';
import { GoogleContactsService } from './google-contacts.service';
import { GoogleContactsController } from './google-contacts.controller';
import { GoogleContactsSyncService } from './google-contacts-sync.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsModule } from '../events/events.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports:     [PrismaModule, EventsModule, AuditLogModule],
  providers:   [GoogleContactsService, GoogleContactsSyncService],
  controllers: [GoogleContactsController],
  exports:     [GoogleContactsService],
})
export class GoogleContactsModule {}
