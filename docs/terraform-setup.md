# Terraform Setup

This document describes the required local setup before running Terraform in this repository.

## Required tfvars file

Before the first `terraform apply`, create a local `infra/.tfvars` file based on `infra/.tfvars.example`.

Example:

```sh
cp infra/.tfvars.example infra/.tfvars
```

## Required values

The values listed in `infra/.tfvars.example` must be filled in before applying the infrastructure.

Current required values:

- `db_password`

## PostgreSQL setup

Terraform provisions a minimal Cloud SQL for PostgreSQL setup.

It creates:

- one single-zone PostgreSQL instance
- one application database
- one application user

The database password must be provided through `infra/.tfvars`.

Review the Cloud SQL resources in `infra/cloudsql.tf` before applying changes, especially if you need different sizing, networking, or database naming.

## Apply flow

Run Terraform from the `infra/` directory:

```sh
cd infra
terraform init
terraform apply
```
