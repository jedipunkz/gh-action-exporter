# GitHub Actions Metrics Exporter

Export GitHub Actions execution metrics to S3/GCS in Parquet format for analysis with DuckDB.

## Features

- **Comprehensive Metrics Collection**: Collect workflow, job, and step execution times, success/failure status, failure reasons, etc.
- **Parquet Format**: Efficient storage and queries with columnar format
- **Multi-Cloud Support**: Supports both S3 and GCS
- **Partitioning**: Partition data by day/month/year
- **DuckDB Compatible**: Query directly with SQL
- **Built with Bun**: Fast execution and simple dependency management

## Collected Metrics

### Workflow Information
- Run ID, run number, workflow name
- Status (queued, in_progress, completed)
- Conclusion (success, failure, cancelled, etc.)
- Duration (milliseconds)
- Trigger event, branch, commit SHA
- Retry count

### Job Information
- Job ID, job name
- Status and conclusion
- Duration
- Runner information (name, group, labels)

### Step Information
- Step number, step name
- Status and conclusion
- Duration

## Installation

### Use as GitHub Action

The easiest way is to use it as a GitHub Action.

```yaml
- uses: owner/gh-action-exporter@v1
  with:
    storage_type: s3
    bucket: my-metrics-bucket
    aws_access_key_id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws_secret_access_key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

### Local Installation

```bash
bun install
bun run build
```

## Usage

### Use in GitHub Actions

#### Export to S3 (IAM Role Recommended)

IAM Role authentication using OIDC is recommended. It's more secure as you don't need to store long-lived credentials.

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
      id-token: write  # Required for OIDC token
      actions: read
      contents: read

    steps:
      - uses: actions/checkout@v4

      # Configure AWS credentials with IAM role
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

#### Export to S3 (Access Key)

You can also use access keys as a traditional method.

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

#### Export to GCS (Workload Identity Recommended)

Keyless authentication using Workload Identity Federation is recommended.

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
      id-token: write  # Required for OIDC token
      actions: read
      contents: read

    steps:
      - uses: actions/checkout@v4

      # Authenticate to GCS with Workload Identity Federation
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

#### Export to GCS (Service Account Key)

You can also use service account keys as a traditional method.

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

### Use as CLI

```bash
# Export to S3
bun run src/index.ts export \
  --repository owner/repo \
  --run-id 12345 \
  --token $GITHUB_TOKEN \
  --storage-type s3 \
  --bucket my-bucket \
  --region us-east-1

# Export to GCS
bun run src/index.ts export \
  --repository owner/repo \
  --run-id 12345 \
  --token $GITHUB_TOKEN \
  --storage-type gcs \
  --bucket my-bucket \
  --project-id my-project

# Export current workflow run (inside GitHub Actions)
bun run src/index.ts export-current
```

## Configuration

### Input Parameters

| Parameter | Required | Default | Description |
|----------|------|-----------|------|
| `storage_type` | ✅ | - | Storage type (`s3` or `gcs`) |
| `bucket` | ✅ | - | Bucket name |
| `prefix` | ❌ | `gh-actions-metrics` | Storage path prefix |
| `github_token` | ❌ | `${{ github.token }}` | GitHub API token |
| `partition_by` | ❌ | `day` | Partition unit (`day`, `month`, `year`) |

#### S3-Specific Parameters

| Parameter | Required | Default | Description |
|----------|------|-----------|------|
| `aws_region` | ❌ | `us-east-1` | AWS region |
| `aws_access_key_id` | ❌ | - | AWS access key ID (not required when using IAM Role) |
| `aws_secret_access_key` | ❌ | - | AWS secret access key (not required when using IAM Role) |

**Note**: When using [aws-actions/configure-aws-credentials](https://github.com/marketplace/actions/configure-aws-credentials-action-for-github-actions) to authenticate with IAM Role, `aws_access_key_id` and `aws_secret_access_key` are not required.

#### GCS-Specific Parameters

| Parameter | Required | Default | Description |
|----------|------|-----------|------|
| `gcp_project_id` | ❌ | - | GCP project ID (not required when using Workload Identity) |
| `gcp_credentials` | ❌ | - | GCP service account key (not required when using Workload Identity) |

**Note**: When using [google-github-actions/auth](https://github.com/marketplace/actions/authenticate-to-google-cloud) to authenticate with Workload Identity Federation, `gcp_credentials` is not required.

### Output Parameters

| Parameter | Description |
|----------|------|
| `uploaded_url` | URL of the uploaded Parquet file |
| `record_count` | Number of records exported |
| `file_size` | File size in bytes |

## Authentication Setup

### AWS IAM Role (Recommended)

Steps to set up IAM Role authentication using OIDC:

1. **Create IAM Identity Provider**
   - Provider type: `OpenID Connect`
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`

2. **Create IAM Role**
   - Set the following Trust Policy:
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

3. **Grant S3 Access Permissions**
   - Add S3 access permissions to the role (e.g., `s3:PutObject`)

For details, see [AWS Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services).

### GCS Workload Identity Federation (Recommended)

Steps to set up Workload Identity Federation:

1. **Create Workload Identity Pool**
   ```bash
   gcloud iam workload-identity-pools create github-pool \
     --location="global" \
     --display-name="GitHub Actions Pool"
   ```

2. **Create Workload Identity Provider**
   ```bash
   gcloud iam workload-identity-pools providers create-oidc github-provider \
     --location="global" \
     --workload-identity-pool="github-pool" \
     --issuer-uri="https://token.actions.githubusercontent.com" \
     --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
     --attribute-condition="assertion.repository_owner=='owner'"
   ```

3. **Grant Permissions to Service Account**
   ```bash
   gcloud iam service-accounts add-iam-policy-binding \
     github-actions@my-project.iam.gserviceaccount.com \
     --role="roles/iam.workloadIdentityUser" \
     --member="principalSet://iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/github-pool/attribute.repository/owner/repo"
   ```

4. **Grant GCS Bucket Access**
   ```bash
   gsutil iam ch serviceAccount:github-actions@my-project.iam.gserviceaccount.com:objectCreator gs://my-bucket
   ```

For details, see [GCP Documentation](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines).

## Analysis with DuckDB

The exported Parquet files can be queried directly with DuckDB.

### Setup

```sql
-- Reading from S3
INSTALL httpfs;
LOAD httpfs;
SET s3_region='us-east-1';
SET s3_access_key_id='YOUR_KEY';
SET s3_secret_access_key='YOUR_SECRET';

-- Reading from GCS
INSTALL httpfs;
LOAD httpfs;
```

### Query Examples

#### Workflow Success Rate

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

#### Average Job Execution Time

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

#### Most Frequently Failing Steps

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

#### Monthly Cost Estimation

```sql
-- GitHub Actions: Linux runners cost $0.008/minute
SELECT
  year,
  month,
  ROUND(SUM(workflowDurationMs) / 1000.0 / 60.0, 2) as total_minutes,
  ROUND(SUM(workflowDurationMs) / 1000.0 / 60.0 * 0.008, 2) as estimated_cost_usd
FROM read_parquet('s3://my-bucket/gh-actions-metrics/**/*.parquet')
GROUP BY year, month
ORDER BY year DESC, month DESC;
```

See [examples/duckdb-query.sql](examples/duckdb-query.sql) for more query examples.

## Data Structure

The exported Parquet files have the following schema:

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

## Partitioning

Data is stored according to the specified partition strategy:

### Daily Partition (Default)
```
s3://bucket/prefix/year=2024/month=01/day=15/metrics-2024-01-15T12-00-00.parquet
```

### Monthly Partition
```
s3://bucket/prefix/year=2024/month=01/metrics-2024-01-15T12-00-00.parquet
```

### Yearly Partition
```
s3://bucket/prefix/year=2024/metrics-2024-01-15T12-00-00.parquet
```

## Development

### Environment Setup

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Build
bun run build

# Type check
bun run typecheck
```

### Project Structure

```
gh-action-exporter/
├── src/
│   ├── types/
│   │   └── metrics.ts          # Type definitions
│   ├── github/
│   │   └── client.ts           # GitHub API client
│   ├── storage/
│   │   ├── s3.ts               # S3 storage
│   │   ├── gcs.ts              # GCS storage
│   │   └── index.ts            # Storage factory
│   ├── parquet/
│   │   └── writer.ts           # Parquet writer
│   ├── exporter.ts             # Main export logic
│   └── index.ts                # CLI entry point
├── examples/
│   ├── workflow-s3.yml         # S3 workflow example
│   ├── workflow-gcs.yml        # GCS workflow example
│   └── duckdb-query.sql        # DuckDB query examples
├── action.yml                   # GitHub Action metadata
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### GitHub API Rate Limiting

GitHub API has [rate limits](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting). Authenticated requests allow up to 5,000 requests per hour.

### S3/GCS Authentication Errors

- S3: Verify that AWS credentials are configured correctly
- GCS: Verify that service account keys are configured correctly

### Out of Memory

For large workflow runs, you may encounter out-of-memory errors. In this case, adjust the partition strategy.

## License

MIT

## Contributing

Pull requests are welcome!

## Related Links

- [GitHub Actions API](https://docs.github.com/en/rest/actions)
- [Parquet Format](https://parquet.apache.org/)
- [DuckDB](https://duckdb.org/)
- [Bun](https://bun.sh/)
