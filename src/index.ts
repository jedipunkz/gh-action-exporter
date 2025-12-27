#!/usr/bin/env bun

/**
 * GitHub Actions メトリクスエクスポーター CLI
 */

import { Command } from 'commander';
import { MetricsExporter } from './exporter.js';
import type { StorageConfig } from './types/metrics.js';

const program = new Command();

program
  .name('gh-action-exporter')
  .description('Export GitHub Actions metrics to S3/GCS in Parquet format')
  .version('0.1.0');

program
  .command('export')
  .description('Export workflow run metrics')
  .option(
    '-r, --repository <repository>',
    'Repository in owner/repo format',
    process.env.GITHUB_REPOSITORY
  )
  .option(
    '--run-id <runId>',
    'Workflow run ID',
    process.env.GITHUB_RUN_ID
  )
  .option(
    '-t, --token <token>',
    'GitHub token',
    process.env.GITHUB_TOKEN
  )
  .option(
    '--storage-type <type>',
    'Storage type (s3 or gcs)',
    process.env.STORAGE_TYPE
  )
  .option(
    '--bucket <bucket>',
    'Storage bucket name',
    process.env.STORAGE_BUCKET
  )
  .option(
    '--prefix <prefix>',
    'Storage path prefix',
    process.env.STORAGE_PREFIX || 'gh-actions-metrics'
  )
  .option(
    '--region <region>',
    'AWS region (for S3)',
    process.env.AWS_REGION
  )
  .option(
    '--project-id <projectId>',
    'GCP project ID (for GCS)',
    process.env.GCP_PROJECT_ID
  )
  .option(
    '--partition-by <partition>',
    'Partition by day, month, or year',
    'day'
  )
  .action(async (options) => {
    try {
      // 必須パラメータのバリデーション
      if (!options.repository) {
        throw new Error('Repository is required (--repository or GITHUB_REPOSITORY)');
      }

      if (!options.runId) {
        throw new Error('Run ID is required (--run-id or GITHUB_RUN_ID)');
      }

      if (!options.token) {
        throw new Error('GitHub token is required (--token or GITHUB_TOKEN)');
      }

      if (!options.storageType) {
        throw new Error('Storage type is required (--storage-type or STORAGE_TYPE)');
      }

      if (!options.bucket) {
        throw new Error('Bucket name is required (--bucket or STORAGE_BUCKET)');
      }

      // ストレージ設定を構築
      const storageConfig: StorageConfig = {
        type: options.storageType as 's3' | 'gcs',
        bucket: options.bucket,
        prefix: options.prefix,
      };

      if (options.storageType === 's3') {
        storageConfig.region = options.region;
      } else if (options.storageType === 'gcs') {
        storageConfig.projectId = options.projectId;
      }

      // エクスポート実行
      const exporter = new MetricsExporter(options.token);

      const result = await exporter.export({
        storage: storageConfig,
        githubToken: options.token,
        repository: options.repository,
        runId: parseInt(options.runId, 10),
        partitionBy: options.partitionBy,
      });

      if (result.success) {
        console.log('\n🎉 Export completed successfully!');
        console.log(`Records: ${result.recordCount}`);
        console.log(`File size: ${result.fileSize} bytes`);
        console.log(`Location: ${result.uploadedUrl}`);
        process.exit(0);
      } else {
        console.error('\n❌ Export failed:');
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// GitHub Actions 用の簡易コマンド
program
  .command('export-current')
  .description('Export current workflow run (for use in GitHub Actions)')
  .action(async () => {
    try {
      // GitHub Actions 環境変数から自動取得
      const repository = process.env.GITHUB_REPOSITORY;
      const runId = process.env.GITHUB_RUN_ID;
      const token = process.env.GITHUB_TOKEN;
      const storageType = process.env.STORAGE_TYPE;
      const bucket = process.env.STORAGE_BUCKET;
      const prefix = process.env.STORAGE_PREFIX || 'gh-actions-metrics';

      if (!repository || !runId || !token || !storageType || !bucket) {
        throw new Error(
          'Missing required environment variables. ' +
          'Required: GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_TOKEN, STORAGE_TYPE, STORAGE_BUCKET'
        );
      }

      const storageConfig: StorageConfig = {
        type: storageType as 's3' | 'gcs',
        bucket,
        prefix,
      };

      if (storageType === 's3') {
        storageConfig.region = process.env.AWS_REGION;
      } else if (storageType === 'gcs') {
        storageConfig.projectId = process.env.GCP_PROJECT_ID;
      }

      const exporter = new MetricsExporter(token);

      const result = await exporter.export({
        storage: storageConfig,
        githubToken: token,
        repository,
        runId: parseInt(runId, 10),
        partitionBy: (process.env.PARTITION_BY as 'day' | 'month' | 'year') || 'day',
      });

      if (result.success) {
        console.log('\n🎉 Export completed successfully!');
        console.log(`Records: ${result.recordCount}`);
        console.log(`Location: ${result.uploadedUrl}`);

        // GitHub Actions の出力として設定
        if (process.env.GITHUB_OUTPUT) {
          await Bun.write(
            process.env.GITHUB_OUTPUT,
            `uploaded_url=${result.uploadedUrl}\n` +
            `record_count=${result.recordCount}\n` +
            `file_size=${result.fileSize}\n`,
            { append: true }
          );
        }

        process.exit(0);
      } else {
        console.error('\n❌ Export failed:');
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
