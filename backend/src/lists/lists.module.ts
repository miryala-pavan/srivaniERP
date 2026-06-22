import { Module } from '@nestjs/common';
import { ListsService } from './lists.service';
import { ListsController, WebhookController } from './lists.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  providers:   [ListsService],
  controllers: [ListsController, WebhookController],
  exports:     [ListsService],
})
export class ListsModule {}
