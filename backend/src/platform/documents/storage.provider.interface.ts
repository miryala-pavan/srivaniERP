export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  sha256Hash: string;
}

export abstract class StorageProvider {
  abstract put(
    key: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StoredFile>;

  abstract get(key: string): Promise<Buffer>;
  abstract delete(key: string): Promise<void>;
  abstract signedUrl(key: string, expirySeconds: number): Promise<string>;
}
