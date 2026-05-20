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
- `infra/` - Terraform configuration
- `functions/basic-http/` - healthcheck HTTP function
- `functions/auth/` - JWT issuing HTTP function

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
