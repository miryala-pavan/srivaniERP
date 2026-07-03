import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageProvider } from './storage.provider.interface';

export interface UploadDocumentDto {
  businessId: string;
  uploadedByUserId?: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  category?: string;
  linkedTable?: string;
  linkedRecordId?: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageProvider,
  ) {}

  async upload(dto: UploadDocumentDto) {
    const sha256Hash = createHash('sha256').update(dto.buffer).digest('hex');
    const storageKey = `${dto.businessId}/${Date.now()}-${dto.filename}`;

    const stored = await this.storage.put(storageKey, dto.buffer, dto.mimeType);

    return this.prisma.document.create({
      data: {
        businessId: dto.businessId,
        uploadedByUserId: dto.uploadedByUserId,
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: stored.sizeBytes,
        storageKey: stored.storageKey,
        sha256Hash,
        category: dto.category,
        linkedTable: dto.linkedTable,
        linkedRecordId: dto.linkedRecordId,
      },
    });
  }

  async getSignedUrl(documentId: string, expirySeconds = 3600): Promise<string> {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    return this.storage.signedUrl(doc.storageKey, expirySeconds);
  }

  async verifyIntegrity(documentId: string): Promise<boolean> {
    const doc = await this.prisma.document.findUniqueOrThrow({ where: { id: documentId } });
    const buffer = await this.storage.get(doc.storageKey);
    const hash = createHash('sha256').update(buffer).digest('hex');
    return hash === doc.sha256Hash;
  }
}
