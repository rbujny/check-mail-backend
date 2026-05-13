# check-mail-backend

Basic GCP infrastructure setup for the backend using Terraform.

## What is included

- Terraform backend stored in GCS bucket `checkmail-plugin-dev-state`
- Basic Google Cloud Functions Gen2 deployment
- TypeScript HTTP function source

## Structure

- `infra/` - Terraform configuration
- `functions/basic-http/` - Cloud Function source code

## First run

```powershell
cd infra
terraform init
terraform apply
```

The Terraform backend is configured to use the existing bucket:

- `checkmail-plugin-dev-state`
