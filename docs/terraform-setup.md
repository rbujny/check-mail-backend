# Terraform Setup

This document describes how Terraform is deployed for this repository.

## Deployment workflow

Terraform deployments run only through GitHub Actions. The deployment workflow is `.github/workflows/deploy.yml`.

The workflow runs on:

- pushes to `main`
- manual `workflow_dispatch` runs from the GitHub Actions tab

## GitHub Secrets

Configure these repository secrets before deploying:

- `CHECKMAIL_GCP_CREDENTIALS_JSON`
- `CHECKMAIL_PROJECT_ID`
- `CHECKMAIL_REGION`
- `CHECKMAIL_DB_PASSWORD`
- `CHECKMAIL_JWT_SECRET`
- `CHECKMAIL_JWT_ISSUER`
- `CHECKMAIL_JWT_AUDIENCE`
- `CHECKMAIL_JWT_EXPIRES_IN`

`CHECKMAIL_GCP_CREDENTIALS_JSON` must contain JSON credentials for a Google Cloud service account that can read and write the Terraform GCS backend and manage the resources defined in `infra/`.

The workflow maps secrets into Terraform variables:

```sh
CHECKMAIL_PROJECT_ID -> TF_VAR_project_id
CHECKMAIL_REGION -> TF_VAR_region
CHECKMAIL_DB_PASSWORD -> TF_VAR_db_password
CHECKMAIL_JWT_SECRET -> TF_VAR_jwt_secret
CHECKMAIL_JWT_ISSUER -> TF_VAR_jwt_issuer
CHECKMAIL_JWT_AUDIENCE -> TF_VAR_jwt_audience
CHECKMAIL_JWT_EXPIRES_IN -> TF_VAR_jwt_expires_in
```

## Terraform flow

The workflow runs:

1. `terraform fmt -check`
2. `terraform init`
3. `terraform validate`
4. `terraform plan -out=tfplan`
5. `terraform apply -auto-approve tfplan`

Do not run `terraform apply` locally for the shared environment.

## PostgreSQL setup

Terraform provisions a minimal Cloud SQL for PostgreSQL setup.

It creates:

- one single-zone PostgreSQL instance
- one application database
- one application user

The database password is provided through the `CHECKMAIL_DB_PASSWORD` GitHub Secret.

Review the Cloud SQL resources in `infra/cloudsql.tf` before applying changes, especially if you need different sizing, networking, or database naming.
