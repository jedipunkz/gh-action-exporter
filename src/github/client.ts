/**
 * GitHub API クライアント
 * ワークフロー実行のメトリクスを取得
 */

import { Octokit } from '@octokit/rest';
import type {
  WorkflowRunMetrics,
  JobMetrics,
  StepMetrics,
  FlatMetrics,
} from '../types/metrics.js';

export class GitHubMetricsClient {
  private octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  /**
   * ワークフロー実行のメトリクスを取得
   */
  async getWorkflowRunMetrics(
    owner: string,
    repo: string,
    runId: number
  ): Promise<WorkflowRunMetrics> {
    const { data: run } = await this.octokit.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId,
    });

    const durationMs = this.calculateDuration(
      run.run_started_at,
      run.updated_at
    );

    return {
      workflowRunId: run.id,
      workflowRunNumber: run.run_number,
      workflowName: run.name,
      workflowId: run.workflow_id,

      repositoryOwner: owner,
      repositoryName: repo,
      repositoryFullName: `${owner}/${repo}`,

      status: run.status,
      conclusion: run.conclusion,

      createdAt: run.created_at,
      updatedAt: run.updated_at,
      runStartedAt: run.run_started_at,
      runCompletedAt: run.updated_at,
      durationMs,

      event: run.event,
      headBranch: run.head_branch,
      headSha: run.head_sha,

      runAttempt: run.run_attempt,
      htmlUrl: run.html_url,
    };
  }

  /**
   * ジョブのメトリクスを取得
   */
  async getJobMetrics(
    owner: string,
    repo: string,
    runId: number,
    workflowName: string
  ): Promise<JobMetrics[]> {
    const { data } = await this.octokit.actions.listJobsForWorkflowRun({
      owner,
      repo,
      run_id: runId,
      per_page: 100,
    });

    return data.jobs.map((job) => ({
      jobId: job.id,
      jobName: job.name,

      workflowRunId: runId,
      workflowName,
      repositoryFullName: `${owner}/${repo}`,

      status: job.status,
      conclusion: job.conclusion,

      startedAt: job.started_at,
      completedAt: job.completed_at,
      durationMs: this.calculateDuration(job.started_at, job.completed_at),

      runnerName: job.runner_name,
      runnerGroupName: job.runner_group_name,

      labels: job.labels,

      htmlUrl: job.html_url,
    }));
  }

  /**
   * ステップのメトリクスを取得
   */
  async getStepMetrics(
    owner: string,
    repo: string,
    runId: number,
    workflowName: string
  ): Promise<StepMetrics[]> {
    const jobs = await this.getJobMetrics(owner, repo, runId, workflowName);
    const allSteps: StepMetrics[] = [];

    for (const job of jobs) {
      const { data } = await this.octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });

      const fullJob = data.jobs.find((j) => j.id === job.jobId);
      if (!fullJob?.steps) continue;

      for (const step of fullJob.steps) {
        allSteps.push({
          stepNumber: step.number,
          stepName: step.name,

          jobId: job.jobId,
          jobName: job.jobName,
          workflowRunId: runId,
          workflowName,
          repositoryFullName: `${owner}/${repo}`,

          status: step.status,
          conclusion: step.conclusion,

          startedAt: step.started_at ?? null,
          completedAt: step.completed_at ?? null,
          durationMs: this.calculateDuration(
            step.started_at ?? null,
            step.completed_at ?? null
          ),
        });
      }
    }

    return allSteps;
  }

  /**
   * フラット化されたメトリクスを取得
   * 全ての情報を結合して1つのレコード配列に
   */
  async getFlatMetrics(
    owner: string,
    repo: string,
    runId: number
  ): Promise<FlatMetrics[]> {
    const workflowRun = await this.getWorkflowRunMetrics(owner, repo, runId);
    const jobs = await this.getJobMetrics(
      owner,
      repo,
      runId,
      workflowRun.workflowName
    );
    const steps = await this.getStepMetrics(
      owner,
      repo,
      runId,
      workflowRun.workflowName
    );

    const exportedAt = new Date().toISOString();
    const exportDate = new Date();

    const flatMetrics: FlatMetrics[] = [];

    // ステップごとにフラットなレコードを作成
    for (const step of steps) {
      const job = jobs.find((j) => j.jobId === step.jobId);
      if (!job) continue;

      flatMetrics.push({
        exportedAt,
        year: exportDate.getFullYear(),
        month: exportDate.getMonth() + 1,
        day: exportDate.getDate(),

        workflowRunId: workflowRun.workflowRunId,
        workflowRunNumber: workflowRun.workflowRunNumber,
        workflowName: workflowRun.workflowName,
        workflowId: workflowRun.workflowId,
        workflowStatus: workflowRun.status,
        workflowConclusion: workflowRun.conclusion,
        workflowCreatedAt: workflowRun.createdAt,
        workflowStartedAt: workflowRun.runStartedAt,
        workflowCompletedAt: workflowRun.runCompletedAt,
        workflowDurationMs: workflowRun.durationMs,
        workflowEvent: workflowRun.event,
        workflowRunAttempt: workflowRun.runAttempt,
        workflowHtmlUrl: workflowRun.htmlUrl,

        repositoryOwner: workflowRun.repositoryOwner,
        repositoryName: workflowRun.repositoryName,
        repositoryFullName: workflowRun.repositoryFullName,

        headBranch: workflowRun.headBranch,
        headSha: workflowRun.headSha,

        jobId: job.jobId,
        jobName: job.jobName,
        jobStatus: job.status,
        jobConclusion: job.conclusion,
        jobStartedAt: job.startedAt,
        jobCompletedAt: job.completedAt,
        jobDurationMs: job.durationMs,
        jobRunnerName: job.runnerName,
        jobRunnerGroupName: job.runnerGroupName,
        jobLabels: job.labels.join(','),
        jobHtmlUrl: job.htmlUrl,

        stepNumber: step.stepNumber,
        stepName: step.stepName,
        stepStatus: step.status,
        stepConclusion: step.conclusion,
        stepStartedAt: step.startedAt,
        stepCompletedAt: step.completedAt,
        stepDurationMs: step.durationMs,
      });
    }

    return flatMetrics;
  }

  /**
   * 実行時間を計算（ミリ秒）
   */
  private calculateDuration(
    startedAt: string | null,
    completedAt: string | null
  ): number | null {
    if (!startedAt || !completedAt) return null;

    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();

    return end - start;
  }
}
