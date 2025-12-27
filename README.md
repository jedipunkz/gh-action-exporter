# GitHub Actions Metrics Exporter

GitHub Actionsの実行メトリクスをParquet形式でS3/GCSに保存し、DuckDBで分析できるようにするツールです。

## 特徴

- **包括的なメトリクス収集**: ワークフロー、ジョブ、ステップの実行時間、成功/失敗、失敗理由などを収集
- **Parquet形式**: 列指向フォーマットで効率的なストレージとクエリ
- **マルチクラウド対応**: S3とGCSの両方をサポート
- **パーティショニング**: 日/月/年単位でデータをパーティション化
- **DuckDB対応**: SQLで直接クエリ可能
- **Bun製**: 高速な実行とシンプルな依存関係管理

## 収集されるメトリクス

### ワークフロー情報
- 実行ID、実行番号、ワークフロー名
- ステータス（queued, in_progress, completed）
- 結論（success, failure, cancelled, etc.）
- 実行時間（ミリ秒）
- トリガーイベント、ブランチ、コミットSHA
- リトライ回数

### ジョブ情報
- ジョブID、ジョブ名
- ステータスと結論
- 実行時間
- ランナー情報（名前、グループ、ラベル）

### ステップ情報
- ステップ番号、ステップ名
- ステータスと結論
- 実行時間

## インストール

### GitHub Actionsとして使用

最も簡単な方法は、GitHub Actionsとして使用することです。

```yaml
- uses: owner/gh-action-exporter@v1
  with:
    storage_type: s3
    bucket: my-metrics-bucket
    aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### ローカルインストール

```bash
bun install
bun run build
```

## 使い方

### GitHub Actionsでの使用

#### S3へのエクスポート（IAM Role推奨）

OIDC を使用した IAM Role 認証が推奨されます。長期的な認証情報を保存する必要がなく、よりセキュアです。

```yaml
name: Export Metrics to S3 (with Assume Role)

on:
  workflow_run:
    workflows: ["*"]
    types: [completed]

jobs:
  export-metrics:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # OIDC トークンの取得に必要
      actions: read
      contents: read

    steps:
      - uses: actions/checkout@v4

      # AWS 認証情報を IAM ロールで設定
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsRole
          aws-region: us-east-1

      - name: Export Metrics
        uses: owner/gh-action-exporter@v1
        with:
          storage_type: s3
          bucket: my-metrics-bucket
          prefix: github-actions/metrics
          partition_by: day
```

#### S3へのエクスポート（アクセスキー）

従来の方法として、アクセスキーを使用することもできます。

```yaml
- name: Export Metrics
  uses: owner/gh-action-exporter@v1
  with:
    storage_type: s3
    bucket: my-metrics-bucket
    prefix: github-actions/metrics
    aws_region: us-east-1
    aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    partition_by: day
```

#### GCSへのエクスポート（Workload Identity推奨）

Workload Identity Federation を使用したキーレス認証が推奨されます。

```yaml
name: Export Metrics to GCS (with Workload Identity)

on:
  workflow_run:
    workflows: ["*"]
    types: [completed]

jobs:
  export-metrics:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # OIDC トークンの取得に必要
      actions: read
      contents: read

    steps:
      - uses: actions/checkout@v4

      # GCS 認証情報を Workload Identity Federation で設定
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: 'projects/123456789/locations/global/workloadIdentityPools/github-pool/providers/github-provider'
          service_account: 'github-actions@my-project.iam.gserviceaccount.com'

      - name: Export Metrics
        uses: owner/gh-action-exporter@v1
        with:
          storage_type: gcs
          bucket: my-metrics-bucket
          prefix: github-actions/metrics
          partition_by: day
```

#### GCSへのエクスポート（サービスアカウントキー）

従来の方法として、サービスアカウントキーを使用することもできます。

```yaml
- name: Export Metrics
  uses: owner/gh-action-exporter@v1
  with:
    storage_type: gcs
    bucket: my-metrics-bucket
    prefix: github-actions/metrics
    gcp_project_id: my-project
    gcp_credentials: ${{ secrets.GCP_SA_KEY }}
    partition_by: day
```

### CLIとして使用

```bash
# S3へエクスポート
bun run src/index.ts export \
  --repository owner/repo \
  --run-id 12345 \
  --token $GITHUB_TOKEN \
  --storage-type s3 \
  --bucket my-bucket \
  --region us-east-1

# GCSへエクスポート
bun run src/index.ts export \
  --repository owner/repo \
  --run-id 12345 \
  --token $GITHUB_TOKEN \
  --storage-type gcs \
  --bucket my-bucket \
  --project-id my-project

# 現在のワークフロー実行をエクスポート（GitHub Actions内）
bun run src/index.ts export-current
```

## 設定

### 入力パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|----------|------|-----------|------|
| `storage_type` | ✅ | - | ストレージタイプ（`s3` または `gcs`） |
| `bucket` | ✅ | - | バケット名 |
| `prefix` | ❌ | `gh-actions-metrics` | ストレージパスのプレフィックス |
| `github_token` | ❌ | `${{ github.token }}` | GitHub API トークン |
| `partition_by` | ❌ | `day` | パーティション単位（`day`, `month`, `year`） |

#### S3固有のパラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|----------|------|-----------|------|
| `aws_region` | ❌ | `us-east-1` | AWSリージョン |
| `aws_access_key_id` | ❌ | - | AWS アクセスキーID（IAM Role使用時は不要） |
| `aws_secret_access_key` | ❌ | - | AWS シークレットアクセスキー（IAM Role使用時は不要） |

**注記**: [aws-actions/configure-aws-credentials](https://github.com/marketplace/actions/configure-aws-credentials-action-for-github-actions) を使用してIAM Roleで認証する場合、`aws_access_key_id` と `aws_secret_access_key` は不要です。

#### GCS固有のパラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|----------|------|-----------|------|
| `gcp_project_id` | ❌ | - | GCPプロジェクトID（Workload Identity使用時は不要） |
| `gcp_credentials` | ❌ | - | GCPサービスアカウントキー（Workload Identity使用時は不要） |

**注記**: [google-github-actions/auth](https://github.com/marketplace/actions/authenticate-to-google-cloud) を使用してWorkload Identity Federationで認証する場合、`gcp_credentials` は不要です。

### 出力パラメータ

| パラメータ | 説明 |
|----------|------|
| `uploaded_url` | アップロードされたParquetファイルのURL |
| `record_count` | エクスポートされたレコード数 |
| `file_size` | ファイルサイズ（バイト） |

## 認証のセットアップ

### AWS IAM Role（推奨）

OIDC を使用した IAM Role 認証をセットアップする手順：

1. **IAM Identity Provider を作成**
   - Provider type: `OpenID Connect`
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **IAM Role を作成**
   - Trust Policy に以下を設定：
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
           },
           "StringLike": {
             "token.actions.githubusercontent.com:sub": "repo:owner/repo:*"
           }
         }
       }
     ]
   }
   ```

3. **S3 アクセス権限を付与**
   - Role に S3 へのアクセス権限を追加（`s3:PutObject` など）

詳細は [AWS ドキュメント](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)を参照してください。

### GCS Workload Identity Federation（推奨）

Workload Identity Federation をセットアップする手順：

1. **Workload Identity Pool を作成**
   ```bash
   gcloud iam workload-identity-pools create github-pool \
     --location="global" \
     --display-name="GitHub Actions Pool"
   ```

2. **Workload Identity Provider を作成**
   ```bash
   gcloud iam workload-identity-pools providers create-oidc github-provider \
     --location="global" \
     --workload-identity-pool="github-pool" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository_owner=='owner'"
   ```

3. **サービスアカウントに権限を付与**
   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     github-actions@my-project.iam.gserviceaccount.com \
     --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/github-pool/attribute.repository/owner/repo"
   ```

4. **GCS バケットへのアクセス権限を付与**
   ```bash
   gsutil iam ch serviceAccount:github-actions@my-project.iam.gserviceaccount.com:objectCreator gs://my-bucket
   ```

詳細は [GCP ドキュメント](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)を参照してください。

## DuckDBでの分析

エクスポートされたParquetファイルは、DuckDBで直接クエリできます。

### セットアップ

```sql
-- S3からの読み込み
INSTALL httpfs;
LOAD httpfs;
SET s3_region='us-east-1';
SET s3_access_key_id='YOUR_KEY';
SET s3_secret_access_key='YOUR_SECRET';

-- GCSからの読み込み
INSTALL httpfs;
LOAD httpfs;
```

### クエリ例

#### ワークフローの成功率

```sql
SELECT
  workflowName,
  COUNT(*) as total_runs,
  SUM(CASE WHEN workflowConclusion = 'success' THEN 1 ELSE 0 END) as successful_runs,
  ROUND(100.0 * SUM(CASE WHEN workflowConclusion = 'success' THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY workflowName
ORDER BY total_runs DESC;
```

#### ジョブの平均実行時間

```sql
SELECT
  jobName,
  COUNT(*) as execution_count,
  ROUND(AVG(jobDurationMs) / 1000.0, 2) as avg_duration_seconds
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
WHERE jobDurationMs IS NOT NULL
GROUP BY jobName
ORDER BY avg_duration_seconds DESC;
```

#### 最も失敗するステップ

```sql
SELECT
  stepName,
  COUNT(*) as total_executions,
  SUM(CASE WHEN stepConclusion = 'failure' THEN 1 ELSE 0 END) as failures,
  ROUND(100.0 * SUM(CASE WHEN stepConclusion = 'failure' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY stepName
HAVING failures > 0
ORDER BY failure_rate DESC;
```

#### 月次コスト概算

```sql
-- GitHub Actions: Linuxランナーは $0.008/分
SELECT
  year,
  month,
  ROUND(SUM(workflowDurationMs) / 1000.0 / 60.0, 2) as total_minutes,
  ROUND(SUM(workflowDurationMs) / 1000.0 / 60.0 * 0.008, 2) as estimated_cost_usd
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY year, month
ORDER BY year DESC, month DESC;
```

その他のクエリ例は [examples/duckdb-query.sql](examples/duckdb-query.sql) を参照してください。

## データ構造

エクスポートされるParquetファイルは以下のスキーマを持ちます：

```
exportedAt: string (ISO 8601)
year: int32
month: int32
day: int32

workflowRunId: int64
workflowRunNumber: int32
workflowName: string
workflowStatus: string
workflowConclusion: string (nullable)
workflowDurationMs: int64 (nullable)
workflowEvent: string
workflowHtmlUrl: string

repositoryOwner: string
repositoryName: string
repositoryFullName: string
headBranch: string (nullable)
headSha: string

jobId: int64
jobName: string
jobStatus: string
jobConclusion: string (nullable)
jobDurationMs: int64 (nullable)
jobRunnerName: string (nullable)
jobLabels: string

stepNumber: int32
stepName: string
stepStatus: string
stepConclusion: string (nullable)
stepDurationMs: int64 (nullable)
```

## パーティショニング

データは指定されたパーティション戦略に従って保存されます：

### 日次パーティション（デフォルト）
```
s3://bucket/prefix/year=2024/month=01/day=15/metrics-2024-01-15T12-00-00.parquet
```

### 月次パーティション
```
s3://bucket/prefix/year=2024/month=01/metrics-2024-01-15T12-00-00.parquet
```

### 年次パーティション
```
s3://bucket/prefix/year=2024/metrics-2024-01-15T12-00-00.parquet
```

## 開発

### 環境構築

```bash
# 依存関係をインストール
bun install

# 開発モードで実行
bun run dev

# ビルド
bun run build

# 型チェック
bun run typecheck
```

### プロジェクト構造

```
gh-action-exporter/
├── src/
│   ├── types/
│   │   └── metrics.ts          # 型定義
│   ├── github/
│   │   └── client.ts           # GitHub APIクライアント
│   ├── storage/
│   │   ├── s3.ts               # S3ストレージ
│   │   ├── gcs.ts              # GCSストレージ
│   │   └── index.ts            # ストレージファクトリ
│   ├── parquet/
│   │   └── writer.ts           # Parquetライター
│   ├── exporter.ts             # メインエクスポートロジック
│   └── index.ts                # CLIエントリポイント
├── examples/
│   ├── workflow-s3.yml         # S3ワークフロー例
│   ├── workflow-gcs.yml        # GCSワークフロー例
│   └── duckdb-query.sql        # DuckDBクエリ例
├── action.yml                   # GitHub Actionメタデータ
├── package.json
├── tsconfig.json
└── README.md
```

## トラブルシューティング

### GitHub APIレート制限

GitHub APIには[レート制限](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)があります。認証されたリクエストは1時間あたり5,000リクエストまで可能です。

### S3/GCS認証エラー

- S3: AWS認証情報が正しく設定されているか確認してください
- GCS: サービスアカウントキーが正しく設定されているか確認してください

### メモリ不足

大規模なワークフロー実行の場合、メモリ不足が発生する可能性があります。その場合はパーティション戦略を調整してください。

## ライセンス

MIT

## 貢献

プルリクエストを歓迎します！

## 関連リンク

- [GitHub Actions API](https://docs.github.com/en/rest/actions)
- [Parquet Format](https://parquet.apache.org/)
- [DuckDB](https://duckdb.org/)
- [Bun](https://bun.sh/)
