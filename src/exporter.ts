/**
 * メトリクスエクスポーター
 */

import { GitHubMetricsClient } from './github/client.js';
import { ParquetWriter } from './parquet/writer.js';
import { createStorageClient } from './storage/index.js';
import type { ExportConfig, ExportResult } from './types/metrics.js';
import { unlinkSync } from 'fs';

export class MetricsExporter {
  private githubClient: GitHubMetricsClient;
  private parquetWriter: ParquetWriter;

  constructor(githubToken: string) {
    this.githubClient = new GitHubMetricsClient(githubToken);
    this.parquetWriter = new ParquetWriter();
  }

  /**
   * メトリクスをエクスポート
   */
  async export(config: ExportConfig): Promise<ExportResult> {
    try {
      console.log(`📊 Fetching metrics for run ID: ${config.runId}...`);

      // リポジトリ名をパース
      const [owner, repo] = config.repository.split('/');
      if (!owner || !repo) {
        throw new Error(
          'Invalid repository format. Expected: owner/repo'
        );
      }

      // GitHub API からメトリクスを取得
      const metrics = await this.githubClient.getFlatMetrics(
        owner,
        repo,
        config.runId
      );

      if (metrics.length === 0) {
        throw new Error('No metrics found for the specified workflow run');
      }

      console.log(`✅ Fetched ${metrics.length} metric records`);

      // Parquet ファイルを生成
      console.log('📝 Writing Parquet file...');
      const tempPath = this.parquetWriter.generateTempPath();
      const { recordCount, fileSize } = await this.parquetWriter.writeMetrics(
        metrics,
        tempPath
      );

      console.log(
        `✅ Parquet file created: ${recordCount} records, ${this.formatBytes(fileSize)}`
      );

      // ストレージにアップロード
      const storageClient = createStorageClient(config.storage);

      const remotePath = this.parquetWriter.generatePartitionedPath(
        config.storage.prefix || 'gh-actions-metrics',
        new Date(),
        config.partitionBy || 'day'
      );

      console.log(`☁️  Uploading to ${config.storage.type}...`);
      const uploadedUrl = await storageClient.upload(tempPath, remotePath);

      console.log(`✅ Uploaded to: ${uploadedUrl}`);

      // 一時ファイルを削除
      try {
        unlinkSync(tempPath);
      } catch (error) {
        console.warn(`Warning: Failed to delete temp file: ${tempPath}`);
      }

      return {
        success: true,
        filePath: remotePath,
        recordCount,
        fileSize,
        uploadedUrl,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        success: false,
        filePath: '',
        recordCount: 0,
        fileSize: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * バイト数を人間が読みやすい形式に変換
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
