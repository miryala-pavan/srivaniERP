import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageProvider, StoredFile } from '../storage.provider.interface';

@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath = process.env.LOCAL_STORAGE_PATH ?? './uploads';

  async put(key: string, buffer: Buffer, mimeType: string): Promise<StoredFile> {
    const fullPath = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    const sha256Hash = createHash('sha256').update(buffer).digest('hex');
    return { storageKey: key, sizeBytes: buffer.length, mimeType, sha256Hash };
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.basePath, key));
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(this.basePath, key));
  }

  async signedUrl(key: string, _expirySeconds: number): Promise<string> {
    // Local dev: return a path reference (not a real signed URL)
    return `/uploads/${key}`;
  }
}
