/**
 * Parquet ファイル生成
 */

import * as parquet from 'parquetjs';
import type { FlatMetrics } from '../types/metrics.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Parquet スキーマ定義
 */
const PARQUET_SCHEMA = new parquet.ParquetSchema({
  // タイムスタンプ
  exportedAt: { type: 'UTF8' },
  year: { type: 'INT32' },
  month: { type: 'INT32' },
  day: { type: 'INT32' },

  // ワークフロー情報
  workflowRunId: { type: 'INT64' },
  workflowRunNumber: { type: 'INT32' },
  workflowName: { type: 'UTF8' },
  workflowId: { type: 'INT64' },
  workflowStatus: { type: 'UTF8' },
  workflowConclusion: { type: 'UTF8', optional: true },
  workflowCreatedAt: { type: 'UTF8' },
  workflowStartedAt: { type: 'UTF8', optional: true },
  workflowCompletedAt: { type: 'UTF8', optional: true },
  workflowDurationMs: { type: 'INT64', optional: true },
  workflowEvent: { type: 'UTF8' },
  workflowRunAttempt: { type: 'INT32' },
  workflowHtmlUrl: { type: 'UTF8' },

  // リポジトリ情報
  repositoryOwner: { type: 'UTF8' },
  repositoryName: { type: 'UTF8' },
  repositoryFullName: { type: 'UTF8' },

  // Git 情報
  headBranch: { type: 'UTF8', optional: true },
  headSha: { type: 'UTF8' },

  // ジョブ情報
  jobId: { type: 'INT64' },
  jobName: { type: 'UTF8' },
  jobStatus: { type: 'UTF8' },
  jobConclusion: { type: 'UTF8', optional: true },
  jobStartedAt: { type: 'UTF8', optional: true },
  jobCompletedAt: { type: 'UTF8', optional: true },
  jobDurationMs: { type: 'INT64', optional: true },
  jobRunnerName: { type: 'UTF8', optional: true },
  jobRunnerGroupName: { type: 'UTF8', optional: true },
  jobLabels: { type: 'UTF8' },
  jobHtmlUrl: { type: 'UTF8' },

  // ステップ情報
  stepNumber: { type: 'INT32' },
  stepName: { type: 'UTF8' },
  stepStatus: { type: 'UTF8' },
  stepConclusion: { type: 'UTF8', optional: true },
  stepStartedAt: { type: 'UTF8', optional: true },
  stepCompletedAt: { type: 'UTF8', optional: true },
  stepDurationMs: { type: 'INT64', optional: true },
});

export class ParquetWriter {
  /**
   * Parquet ファイルにメトリクスを書き込み
   */
  async writeMetrics(
    metrics: FlatMetrics[],
    outputPath: string
  ): Promise<{ recordCount: number; fileSize: number }> {
    // ディレクトリが存在しない場合は作成
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Parquet Writer を作成
    const writer = await parquet.ParquetWriter.openFile(
      PARQUET_SCHEMA,
      outputPath,
      {
        compression: 'SNAPPY', // Snappy圧縮を使用
      }
    );

    // データを書き込み
    for (const metric of metrics) {
      await writer.appendRow(metric);
    }

    await writer.close();

    // ファイルサイズを取得
    const fileStats = await Bun.file(outputPath).stat();

    return {
      recordCount: metrics.length,
      fileSize: fileStats.size,
    };
  }

  /**
   * パーティション付きパスを生成
   * 例: s3://bucket/prefix/year=2024/month=01/day=15/metrics.parquet
   */
  generatePartitionedPath(
    basePath: string,
    date: Date,
    partitionBy: 'day' | 'month' | 'year' = 'day'
  ): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    let path = `${basePath}/year=${year}`;

    if (partitionBy === 'month' || partitionBy === 'day') {
      path += `/month=${month}`;
    }

    if (partitionBy === 'day') {
      path += `/day=${day}`;
    }

    // ファイル名にタイムスタンプを含める
    const timestamp = date.toISOString().replace(/[:.]/g, '-');
    path += `/metrics-${timestamp}.parquet`;

    return path;
  }

  /**
   * ローカルの一時ファイルパスを生成
   */
  generateTempPath(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `/tmp/gh-actions-metrics-${timestamp}.parquet`;
  }
}
