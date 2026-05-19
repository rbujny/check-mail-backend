# check-mail-backend

Basic GCP infrastructure setup for the backend using Terraform.

## What is included

- Terraform backend stored in GCS bucket `checkmail-plugin-dev-state`
- Basic Google Cloud Functions Gen2 deployment
- API Gateway deployment from an OpenAPI spec
- Cloud SQL for PostgreSQL setup
- TypeScript HTTP function source
- Auto-discovery of functions from the `functions/*/function.json` files
- Express-wrapped handlers registered with `@google-cloud/functions-framework`

## Structure

- `docs/` - repository documentation
- `infra/` - Terraform configuration
- `functions/basic-http/` - healthcheck HTTP function
- `functions/auth/` - JWT issuing HTTP function

## First run

Before the first Terraform apply, create `infra/.tfvars` from `infra/.tfvars.example` and fill in all required values.

Current required values:

- `db_password`
- `function_env_overrides.auth.JWT_PRIVATE_KEY`

```sh
sh tools/terraform-apply.sh
```

The script runs Terraform for all resources in `infra/` and uses `infra/.tfvars` by default. Use `sh tools/terraform-apply.sh --auto-approve` for non-interactive applies.

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

## API Gateway

Terraform deploys an API Gateway from `infra/openapi/checkmail.yaml.tftpl`.

Current gateway routes:

- `GET /health` requires a Checkmail JWT
- `POST /auth/token`
- `GET /auth/jwks`

After `terraform apply`, use the `api_gateway_url` output as the public base URL.

API Gateway configs are immutable. When the OpenAPI template changes, update `api_gateway_config_id` before applying.

`POST /auth/token` signs JWTs with `RS256`. Provide `JWT_PRIVATE_KEY` outside the repository through Terraform environment overrides or secret injection. API Gateway validates protected routes with the public JWKS exposed by the auth function.


## Codex team setup

Repo includes shared Codex guidance and bootstrap files:

- `AGENTS.md` for repository rules
- `tools/codex/skills/gcp-backend/SKILL.md` for a shared skill
- `tools/codex/setup-codex.sh` to install the repo skill locally and append an MCP entry to `~/.codex/config.toml`

Run:

```sh
sh tools/codex/setup-codex.sh
```
