/**
 * Type definitions for GitHub Actions metrics
 * Structured information retrieved from GitHub API
 */

/**
 * Overall workflow run information
 */
export interface WorkflowRunMetrics {
  // Basic information
  workflowRunId: number;
  workflowRunNumber: number;
  workflowName: string;
  workflowId: number;

  // Repository information
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;

  // Execution information
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped, timed_out, action_required

  // Timestamp information
  createdAt: string;
  updatedAt: string;
  runStartedAt: string | null;
  runCompletedAt: string | null;
  durationMs: number | null; // Execution time in milliseconds

  // Trigger information
  event: string; // push, pull_request, workflow_dispatch, etc.
  headBranch: string | null;
  headSha: string;

  // Other
  runAttempt: number;
  htmlUrl: string;
}

/**
 * Job information
 */
export interface JobMetrics {
  // Basic information
  jobId: number;
  jobName: string;

  // Parent information
  workflowRunId: number;
  workflowName: string;
  repositoryFullName: string;

  // Execution information
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped

  // Timestamp information
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;

  // Runner information
  runnerName: string | null;
  runnerGroupName: string | null;

  // Labels
  labels: string[]; // ubuntu-latest, etc.

  // URL
  htmlUrl: string;
}

/**
 * Step information
 */
export interface StepMetrics {
  // Basic information
  stepNumber: number;
  stepName: string;

  // Parent information
  jobId: number;
  jobName: string;
  workflowRunId: number;
  workflowName: string;
  repositoryFullName: string;

  // Execution information
  status: string; // queued, in_progress, completed
  conclusion: string | null; // success, failure, cancelled, skipped

  // Timestamp information
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

/**
 * Flattened metrics for Parquet storage
 * All information combined into a single record
 */
export interface FlatMetrics {
  // Timestamp (for partitioning)
  exportedAt: string;
  year: number;
  month: number;
  day: number;

  // Workflow information
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

  // Repository information
  repositoryOwner: string;
  repositoryName: string;
  repositoryFullName: string;

  // Git information
  headBranch: string | null;
  headSha: string;

  // Job information
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

  // Step information
  stepNumber: number;
  stepName: string;
  stepStatus: string;
  stepConclusion: string | null;
  stepStartedAt: string | null;
  stepCompletedAt: string | null;
  stepDurationMs: number | null;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: 's3' | 'gcs';
  bucket: string;
  prefix?: string;

  // S3-specific
  region?: string;
  endpoint?: string;

  // GCS-specific
  projectId?: string;
  keyFilename?: string;
}

/**
 * Export configuration
 */
export interface ExportConfig {
  storage: StorageConfig;

  // GitHub information
  githubToken: string;
  repository: string; // owner/repo format
  runId: number;

  // Options
  includeSteps?: boolean;
  partitionBy?: 'day' | 'month' | 'year';
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  filePath: string;
  recordCount: number;
  fileSize: number;
  uploadedUrl?: string;
  error?: string;
}
