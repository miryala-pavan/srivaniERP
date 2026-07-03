import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { StorageProvider } from './storage.provider.interface';
import { LocalStorageProvider } from './providers/local.provider';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    DocumentsService,
    { provide: StorageProvider, useClass: LocalStorageProvider },
  ],
  exports: [DocumentsService],
})
export class DocumentsModule {}
