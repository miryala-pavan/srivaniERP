import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { InboxService } from './inbox.service';
import { OutboxProcessor } from './outbox.processor';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OutboxService, InboxService, OutboxProcessor],
  exports: [OutboxService, InboxService],
})
export class PlatformEventsModule {}
