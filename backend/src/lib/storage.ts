// Storage abstraction layer.
// Switch between local disk and S3-compatible storage via STORAGE_BACKEND env var.
// Required env vars for S3: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY
// Default: LocalStorageAdapter (STORAGE_BACKEND=local or unset)

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export interface StorageAdapter {
  /** Write file buffer at the given key, return the public URL */
  upload(file: Buffer, key: string, mimeType?: string): Promise<string>;
  /** Delete the object at the given key */
  delete(key: string): Promise<void>;
  /** Return the public URL for a key (without writing) */
  url(key: string): string;
}

class LocalStorageAdapter implements StorageAdapter {
  async upload(file: Buffer, key: string): Promise<string> {
    const dest = path.join(config.UPLOAD_DIR, key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file);
    return this.url(key);
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(path.join(config.UPLOAD_DIR, key)).catch(() => undefined);
  }

  url(key: string): string {
    return `/uploads/${key}`;
  }
}

class S3StorageAdapter implements StorageAdapter {
  private endpoint: string;
  private bucket: string;
  private accessKey: string;
  private secretKey: string;

  constructor() {
    this.endpoint = process.env.S3_ENDPOINT ?? '';
    this.bucket = process.env.S3_BUCKET ?? '';
    this.accessKey = process.env.S3_ACCESS_KEY ?? '';
    this.secretKey = process.env.S3_SECRET_KEY ?? '';
    if (!this.endpoint || !this.bucket || !this.accessKey || !this.secretKey) {
      throw new Error('S3 storage requires S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY');
    }
  }

  async upload(_file: Buffer, _key: string, _mimeType?: string): Promise<string> {
    // Wire a real S3 client (e.g. @aws-sdk/client-s3 or minio SDK) in Phase 12
    throw new Error('S3StorageAdapter.upload: not yet implemented');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('S3StorageAdapter.delete: not yet implemented');
  }

  url(key: string): string {
    return `${this.endpoint}/${this.bucket}/${key}`;
  }
}

function createStorageAdapter(): StorageAdapter {
  const backend = process.env.STORAGE_BACKEND ?? 'local';
  if (backend === 's3') return new S3StorageAdapter();
  return new LocalStorageAdapter();
}

export const storage: StorageAdapter = createStorageAdapter();
