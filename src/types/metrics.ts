/**
 * GitHub Actions メトリクスの型定義
 * GitHub API から取得できる情報を構造化
 */

/**
 * ワークフロー実行全体の情報
 */
export interface WorkflowRunMetrics {
  // 基本情報
  workflowRunId: number;
  workflowRunNumber: number;
  workflowName: string;
  workflowId: number;

  // リポジトリ情報
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;

  // 実行情報
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped, timed_out, action_required

  // 時刻情報
  createdAt: string;
  updatedAt: string;
  runStartedAt: string | null;
  runCompletedAt: string | null;
  durationMs: number | null; // 実行時間（ミリ秒）

  // トリガー情報
  event: string; // push, pull_request, workflow_dispatch など
  headBranch: string | null;
  headSha: string;

  // その他
  runAttempt: number;
  htmlUrl: string;
}

/**
 * ジョブの情報
 */
export interface JobMetrics {
  // 基本情報
  jobId: number;
  jobName: string;

  // 親情報
  workflowRunId: number;
  workflowName: string;
  repositoryFullName: string;

  // 実行情報
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped

  // 時刻情報
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;

  // ランナー情報
  runnerName: string | null;
  runnerGroupName: string | null;

  // ラベル
  labels: string[]; // ubuntu-latest など

  // URL
  htmlUrl: string;
}

/**
 * ステップの情報
 */
export interface StepMetrics {
  // 基本情報
  stepNumber: number;
  stepName: string;

  // 親情報
  jobId: number;
  jobName: string;
  workflowRunId: number;
  workflowName: string;
  repositoryFullName: string;

  // 実行情報
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped

  // 時刻情報
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

/**
 * Parquet保存用のフラット化されたメトリクス
 * 全ての情報を1つのレコードにまとめる
 */
export interface FlatMetrics {
  // タイムスタンプ（パーティショニング用）
  exportedAt: string;
  year: number;
  month: number;
  day: number;

  // ワークフロー情報
  workflowRunId: number;
  workflowRunNumber: number;
  workflowName: string;
  workflowId: number;
  workflowStatus: string;
  workflowConclusion: string | null;
  workflowCreatedAt: string;
  workflowStartedAt: string | null;
  workflowCompletedAt: string | null;
  workflowDurationMs: number | null;
  workflowEvent: string;
  workflowRunAttempt: number;
  workflowHtmlUrl: string;

  // リポジトリ情報
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;

  // Git情報
  headBranch: string | null;
  headSha: string;

  // ジョブ情報
  jobId: number;
  jobName: string;
  jobStatus: string;
  jobConclusion: string | null;
  jobStartedAt: string | null;
  jobCompletedAt: string | null;
  jobDurationMs: number | null;
  jobRunnerName: string | null;
  jobRunnerGroupName: string | null;
  jobLabels: string;
  jobHtmlUrl: string;

  // ステップ情報
  stepNumber: number;
  stepName: string;
  stepStatus: string;
  stepConclusion: string | null;
  stepStartedAt: string | null;
  stepCompletedAt: string | null;
  stepDurationMs: number | null;
}

/**
 * ストレージ設定
 */
export interface StorageConfig {
  type: 's3' | 'gcs';
  bucket: string;
  prefix?: string;

  // S3固有
  region?: string;
  endpoint?: string;

  // GCS固有
  projectId?: string;
  keyFilename?: string;
}

/**
 * エクスポート設定
 */
export interface ExportConfig {
  storage: StorageConfig;

  // GitHub情報
  githubToken: string;
  repository: string; // owner/repo 形式
  runId: number;

  // オプション
  includeSteps?: boolean;
  partitionBy?: 'day' | 'month' | 'year';
}

/**
 * エクスポート結果
 */
export interface ExportResult {
  success: boolean;
  filePath: string;
  recordCount: number;
  fileSize: number;
  uploadedUrl?: string;
  error?: string;
}
