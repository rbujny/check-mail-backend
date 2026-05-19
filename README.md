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

## Deployment

This repository uses one shared environment across developers. Deployments run only through the GitHub Actions workflow in `.github/workflows/deploy.yml`.

Configure these GitHub repository secrets before running the workflow:

- `CHECKMAIL_GCP_CREDENTIALS_JSON`
- `CHECKMAIL_PROJECT_ID`
- `CHECKMAIL_REGION`
- `CHECKMAIL_DB_PASSWORD`
- `CHECKMAIL_JWT_SECRET`
- `CHECKMAIL_JWT_ISSUER`
- `CHECKMAIL_JWT_AUDIENCE`
- `CHECKMAIL_JWT_EXPIRES_IN`

The workflow maps GitHub Secrets to Terraform `TF_VAR_*` environment variables and runs `terraform init`, `terraform validate`, `terraform plan`, and `terraform apply`.

The workflow runs on pushes to `main` and can also be started manually from the GitHub Actions tab.

The Terraform backend is configured to use the existing bucket:

- `checkmail-plugin-dev-state`

## Local development

Local development is for Cloud Functions only. Run a function from its directory with the Functions Framework:

```sh
cd functions/basic-http
npm install
npm run start
```

Use GitHub Actions for infrastructure and shared environment deployments.

## Adding another function

To add a new function, create a new directory under `functions/` with:

- `package.json`
- `tsconfig.json`
- `src/index.ts`
- `function.json`

Terraform automatically discovers every `functions/*/function.json` file and deploys it as a separate Cloud Function Gen2.

Function conventions are documented in `docs/functions.md`.


## Codex team setup

Repo includes shared Codex guidance and bootstrap files:

- `AGENTS.md` for repository rules
- `tools/codex/skills/gcp-backend/SKILL.md` for a shared skill
- `tools/codex/setup-codex.sh` to install the repo skill locally and append an MCP entry to `~/.codex/config.toml`

Run:

```sh
sh tools/codex/setup-codex.sh
```
