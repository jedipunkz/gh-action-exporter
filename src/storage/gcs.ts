/**
 * Google Cloud Storage クライアント
 */

import { Storage } from '@google-cloud/storage';
import type { StorageConfig } from '../types/metrics.js';

export class GCSStorage {
  private storage: Storage;
  private bucket: string;
  private prefix: string;

  constructor(config: StorageConfig) {
    if (config.type !== 'gcs') {
      throw new Error('Invalid storage type for GCSStorage');
    }

    this.bucket = config.bucket;
    this.prefix = config.prefix || '';

    this.storage = new Storage({
      projectId: config.projectId || process.env.GCP_PROJECT_ID,
      ...(config.keyFilename && { keyFilename: config.keyFilename }),
    });
  }

  /**
   * ファイルをGCSにアップロード
   */
  async upload(localPath: string, remotePath: string): Promise<string> {
    // プレフィックスを追加
    const destination = this.prefix
      ? `${this.prefix.replace(/\/$/, '')}/${remotePath.replace(/^\//, '')}`
      : remotePath.replace(/^\//, '');

    await this.storage.bucket(this.bucket).upload(localPath, {
      destination,
      metadata: {
        contentType: 'application/octet-stream',
      },
    });

    return `gs://${this.bucket}/${destination}`;
  }

  /**
   * GCS URL を取得
   */
  getUrl(remotePath: string): string {
    const destination = this.prefix
      ? `${this.prefix.replace(/\/$/, '')}/${remotePath.replace(/^\//, '')}`
      : remotePath.replace(/^\//, '');

    return `gs://${this.bucket}/${destination}`;
  }
}
