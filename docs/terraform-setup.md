# Terraform Setup

This document describes the shared-environment Terraform deployment process.

## Deployment workflow

Terraform deployments run only through the manually triggered `.github/workflows/deploy.yml` workflow. It does not run automatically on pushes to `main`.

To deploy, open GitHub Actions, select `Deploy`, and choose `Run workflow`.

## GitHub Variables

Configure the following repository variables for Workload Identity Federation:

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

The deploy workflow also maps `GCP_DEPLOY_SERVICE_ACCOUNT` to `TF_VAR_github_actions_service_account_email`. Terraform uses that email to grant create-only access to the private benchmark-summary bucket used by the benchmark workflow.

The deployment workflow exchanges GitHub's OIDC token for short-lived Google Cloud credentials. No service account JSON key is stored in GitHub.

## GitHub Secrets

Configure the following repository secrets:

- `CHECKMAIL_PROJECT_ID`
- `CHECKMAIL_REGION`
- `CHECKMAIL_DB_PASSWORD`
- `CHECKMAIL_API_GATEWAY_JWT_ISSUER`
- `CHECKMAIL_API_GATEWAY_JWT_AUDIENCE`
- `CHECKMAIL_JWT_PRIVATE_KEY`
- `CHECKMAIL_JWT_KEY_ID`
- `CHECKMAIL_JWT_EXPIRES_IN`

The workflow maps secrets to Terraform variables:

```text
CHECKMAIL_PROJECT_ID                         -> TF_VAR_project_id
CHECKMAIL_REGION                             -> TF_VAR_region
CHECKMAIL_DB_PASSWORD                        -> TF_VAR_db_password
CHECKMAIL_API_GATEWAY_JWT_ISSUER              -> TF_VAR_api_gateway_jwt_issuer
CHECKMAIL_API_GATEWAY_JWT_AUDIENCE            -> TF_VAR_api_gateway_jwt_audience
CHECKMAIL_JWT_PRIVATE_KEY                     -> TF_VAR_jwt_private_key
CHECKMAIL_JWT_KEY_ID                          -> TF_VAR_jwt_key_id
CHECKMAIL_JWT_EXPIRES_IN                      -> TF_VAR_jwt_expires_in
```

The RSA private key must match the public key exposed by the configured JWKS document. `CHECKMAIL_JWT_KEY_ID` must match that JWKS entry's `kid`.

The public JWKS is versioned in `infra/jwks.json` and published by Terraform from a dedicated Cloud Storage bucket in the same project.

The `/process` backend URL is derived directly from the Terraform-managed `process` Cloud Function and does not require a repository secret.

Terraform enables Vertex AI, creates the Firestore vector index, a private processing-result bucket, and a separate private benchmark-summary bucket, and assigns a dedicated runtime service account to the process function. The process service account can create result objects but cannot read, list, overwrite, or delete them. Result retention defaults to 90 days and can be changed with the non-secret `TF_VAR_process_results_retention_days` variable. The GitHub workflow identity receives create-only access to benchmark summaries, which are retained until explicitly deleted. The production model, RAG, and retention settings have checked-in non-secret defaults, so no additional GitHub secret is required. Override them only when needed by adding the corresponding `TF_VAR_*` value to the deployment workflow; the available variables are documented in `docs/llm-rag-analysis.md` and `infra/variables.tf`.

The Workload Identity deployment service account must be able to enable APIs, manage Firestore indexes, create service accounts and IAM bindings, and deploy functions. The manual RAG and benchmark workflows also use this identity and require Vertex AI user and Firestore data access in the target project.

API Gateway uses OpenAPI 3.0.4. Quota identifiers use hyphens as required by Service Management, and Cloud Run Functions backends use HTTP/1.1. The latter avoids selecting the RPC security-policy path used by H2 backends while preserving authenticated invocation through the gateway service account.

## Terraform flow

The workflow runs:

1. `terraform fmt -check -recursive`
2. `terraform init -input=false`
3. `terraform validate -no-color`
4. `terraform plan -input=false -no-color -out=tfplan`
5. `terraform apply -input=false -auto-approve -parallelism=1 tfplan`

Apply is serialized because multiple Cloud Functions Gen2 created concurrently can race while Google Cloud initializes their shared regional source bucket.

Do not run `terraform apply` locally against the shared environment.

## PostgreSQL setup

Terraform provisions a single-zone PostgreSQL Enterprise instance using the shared-core `db-f1-micro` tier, an application database, and an application user. The edition is explicit because PostgreSQL 16 and newer otherwise default to Enterprise Plus, which does not support shared-core tiers. The database password is provided through `CHECKMAIL_DB_PASSWORD`.

Review `infra/cloudsql.tf` before changing database sizing, networking, or naming.
