# check-mail-backend

Basic GCP infrastructure setup for the backend using Terraform.

## What is included

- Terraform backend stored in GCS bucket `checkmail-plugin-dev-state`
- Basic Google Cloud Functions Gen2 deployment
- Cloud SQL for PostgreSQL setup
- TypeScript HTTP function source
- Auto-discovery of functions from the `functions/*/function.json` files
- Express-wrapped handlers registered with `@google-cloud/functions-framework`

## Structure

- `docs/` - repository documentation
- `docs/openapi.yaml` - canonical API contract for future gateway integration
- `infra/` - Terraform configuration
- `infra/apigateway.tf` - optional API Gateway definition for the public REST entrypoint
- `functions/basic-http/` - healthcheck HTTP function
- `functions/auth/` - JWT issuing HTTP function
- `functions/common/email-processing/types.ts` - shared request/response contract types for email processing

## First run

Before the first Terraform apply, create `infra/.tfvars` from `infra/.tfvars.example` and fill in all required values.

Current required values:

- `db_password`

```powershell
cd infra
terraform init
terraform apply
```

The Terraform backend is configured to use the existing bucket:

- `checkmail-plugin-dev-state`

## Adding another function

To add a new function, create a new directory under `functions/` with:

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `function.json`

Terraform automatically discovers every `functions/*/function.json` file and deploys it as a separate Cloud Function Gen2.

Function conventions are documented in `docs/functions.md`.

The canonical backend API contract is documented in `docs/openapi.yaml`.

API Gateway resources are defined in Terraform and remain optional until the processing backend and public JWKS URL are configured. Terraform routes `/token` to the repository's auto-discovered `auth` function. The gateway exposes:

- `POST /token` without JWT authentication, using an API key for quota attribution
- `POST /process` with API key and JWT authentication enforced by API Gateway

Both routes have configurable per-minute, per-consumer-project quotas. Defaults are 10 token requests and 60 processing requests. The auth function signs tokens with RS256 and requires `JWT_PRIVATE_KEY`; its issuer and audience must match the corresponding API Gateway variables.

Clients cannot override the token issuer, audience, or add arbitrary claims. These values are controlled by backend configuration.

Terraform creates a restricted client API key for quota attribution and a dedicated gateway service account with Cloud Functions Invoker access. Retrieve the key with `terraform output -raw api_gateway_client_key`. Configure `api_gateway_jwt_jwks_uri` with a public HTTPS JWKS document generated from the RSA public key matching `JWT_PRIVATE_KEY`.

Pull request checks are documented in `docs/pr-checks.md`.

## Codex team setup

Repo includes shared Codex guidance and bootstrap files:

- `AGENTS.md` for repository rules
- `tools/codex/skills/gcp-backend/SKILL.md` for a shared skill
- `tools/codex/setup-codex.sh` to install the repo skill locally and append an MCP entry to `~/.codex/config.toml`

Run:

```sh
sh tools/codex/setup-codex.sh
```
