/**
 * Storage client factory
 */

import type { StorageConfig } from '../types/metrics.js';
import { S3Storage } from './s3.js';
import { GCSStorage } from './gcs.js';

export interface StorageClient {
  upload(localPath: string, remotePath: string): Promise<string>;
  getUrl(remotePath: string): string;
}

export function createStorageClient(config: StorageConfig): StorageClient {
  switch (config.type) {
    case 's3':
      return new S3Storage(config);
    case 'gcs':
      return new GCSStorage(config);
    default:
      throw new Error(`Unsupported storage type: ${config.type}`);
  }
}

export { S3Storage } from './s3.js';
export { GCSStorage } from './gcs.js';
