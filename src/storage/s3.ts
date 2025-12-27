/**
 * S3 storage client
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import type { StorageConfig } from '../types/metrics.js';

export class S3Storage {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(config: StorageConfig) {
    if (config.type !== 's3') {
      throw new Error('Invalid storage type for S3Storage');
    }

    this.bucket = config.bucket;
    this.prefix = config.prefix || '';

    this.client = new S3Client({
      region: config.region || process.env.AWS_REGION || 'us-east-1',
      ...(config.endpoint && { endpoint: config.endpoint }),
    });
  }

  /**
   * Upload file to S3
   */
  async upload(localPath: string, remotePath: string): Promise<string> {
    const fileContent = readFileSync(localPath);

    // Add prefix
    const key = this.prefix
      ? `${this.prefix.replace(/\/$/, '')}/${remotePath.replace(/^\//, '')}`
      : remotePath.replace(/^\//, '');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileContent,
      ContentType: 'application/octet-stream',
    });

    await this.client.send(command);

    return `s3://${this.bucket}/${key}`;
  }

  /**
   * Get S3 URL
   */
  getUrl(remotePath: string): string {
    const key = this.prefix
      ? `${this.prefix.replace(/\/$/, '')}/${remotePath.replace(/^\//, '')}`
      : remotePath.replace(/^\//, '');

    return `s3://${this.bucket}/${key}`;
  }
}
