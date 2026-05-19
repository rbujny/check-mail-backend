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
- `function_env_overrides.auth.JWT_PRIVATE_KEY`

## Infrastructure overview

Terraform provisions:

- one API Gateway backed by the OpenAPI template in `infra/openapi/checkmail.yaml.tftpl`
- one API Gateway service account with invoker access to the deployed functions and their underlying Gen2 Cloud Run services
- unauthenticated invoker access for the auth function, which issues tokens and exposes public JWKS
- one enabled managed service for the deployed gateway API
- one single-zone PostgreSQL instance
- one application database
- one application user

## Auth function configuration

The auth function uses an RSA private key to sign JWTs for API Gateway authentication. Provide `JWT_PRIVATE_KEY` through `function_env_overrides.auth` in `infra/.tfvars` or through another Terraform secret injection path.

Example:

```hcl
function_env_overrides = {
  auth = {
    JWT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  }
}
```

## Cloud SQL configuration

The database password must be provided through `infra/.tfvars`.

Review the Cloud SQL resources in `infra/cloudsql.tf` before applying changes, especially if you need different sizing, networking, or database naming.

## Apply flow

Run the repository apply script from the repository root:

```sh
sh tools/terraform-apply.sh
```

The script runs `terraform init`, `terraform validate`, `terraform plan`, and `terraform apply` for all resources in `infra/`, using `infra/.tfvars` by default.

For non-interactive applies, pass `--auto-approve`:

```sh
sh tools/terraform-apply.sh --auto-approve
```

To run Terraform manually from the `infra/` directory instead:

```sh
cd infra
terraform init
terraform apply -var-file=.tfvars
```

After apply, Terraform prints `api_gateway_url`. Use that value as the public base URL for routes documented in `docs/api-gateway.md`.
