-- DuckDB でのクエリ例
-- Parquet ファイルから直接クエリ可能

-- S3 から読み込み
-- DuckDB の S3 拡張を有効化: INSTALL httpfs; LOAD httpfs;
-- AWS認証情報を設定: SET s3_region='us-east-1'; SET s3_access_key_id='xxx'; SET s3_secret_access_key='xxx';

-- GCS から読み込み
-- DuckDB の GCS 拡張を有効化: INSTALL httpfs; LOAD httpfs;

-- 1. ワークフロー全体の成功率を計算
SELECT
  workflowName,
  COUNT(*) as total_runs,
  SUM(CASE WHEN workflowConclusion = 'success' THEN 1 ELSE 0 END) as successful_runs,
  ROUND(100.0 * SUM(CASE WHEN workflowConclusion = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY workflowName
ORDER BY total_runs DESC;

-- 2. ジョブごとの平均実行時間
SELECT
  jobName,
  COUNT(*) as execution_count,
  ROUND(AVG(jobDurationMs) / 1000.0, 2) as avg_duration_seconds,
  ROUND(MIN(jobDurationMs) / 1000.0, 2) as min_duration_seconds,
  ROUND(MAX(jobDurationMs) / 1000.0, 2) as max_duration_seconds
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
WHERE jobDurationMs IS NOT NULL
GROUP BY jobName
ORDER BY avg_duration_seconds DESC;

-- 3. ステップごとの失敗率
SELECT
  stepName,
  COUNT(*) as total_executions,
  SUM(CASE WHEN stepConclusion = 'failure' THEN 1 ELSE 0 END) as failures,
  ROUND(100.0 * SUM(CASE WHEN stepConclusion = 'failure' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY stepName
HAVING failures > 0
ORDER BY failure_rate DESC;

-- 4. 日別の実行時間トレンド
SELECT
  DATE_TRUNC('day', CAST(workflowCreatedAt AS TIMESTAMP)) as execution_date,
  workflowName,
  COUNT(DISTINCT workflowRunId) as run_count,
  ROUND(AVG(workflowDurationMs) / 1000.0 / 60.0, 2) as avg_duration_minutes
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY execution_date, workflowName
ORDER BY execution_date DESC, workflowName;

-- 5. 最も遅いステップを特定
SELECT
  workflowName,
  jobName,
  stepName,
  ROUND(AVG(stepDurationMs) / 1000.0, 2) as avg_duration_seconds,
  COUNT(*) as execution_count
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
WHERE stepDurationMs IS NOT NULL
GROUP BY workflowName, jobName, stepName
ORDER BY avg_duration_seconds DESC
LIMIT 20;

-- 6. ブランチ別の成功率
SELECT
  headBranch,
  COUNT(DISTINCT workflowRunId) as total_runs,
  SUM(CASE WHEN workflowConclusion = 'success' THEN 1 ELSE 0 END) as successful_runs,
  ROUND(100.0 * SUM(CASE WHEN workflowConclusion = 'success' THEN 1 ELSE 0 END) / COUNT(DISTINCT workflowRunId), 2) as success_rate
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY headBranch
ORDER BY total_runs DESC;

-- 7. ランナーごとの実行時間
SELECT
  jobLabels,
  COUNT(DISTINCT jobId) as job_count,
  ROUND(AVG(jobDurationMs) / 1000.0 / 60.0, 2) as avg_duration_minutes
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
WHERE jobDurationMs IS NOT NULL
GROUP BY jobLabels
ORDER BY avg_duration_minutes DESC;

-- 8. 月次の実行コスト概算（実行時間ベース）
-- GitHub Actions の料金: Linux ランナーは $0.008/分
SELECT
  year,
  month,
  ROUND(SUM(workflowDurationMs) / 1000.0 / 60.0, 2) as total_minutes,
  ROUND(SUM(workflowDurationMs) / 1000.0 / 60.0 * 0.008, 2) as estimated_cost_usd
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY year, month
ORDER BY year DESC, month DESC;
