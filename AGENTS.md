# AGENTS.md

Collaboration rules for this repository:

## General rules
- update `README.md` when backend behavior, usage, or deployment changes
- write all `.md` files in English
- all documentation should be placed in `/docs`

## Functions
- keep new Cloud Functions in `functions/<name>`
- each function should include `function.json`, `package.json`, `tsconfig.json`, and `src/index.ts`
- register HTTP handlers through `@google-cloud/functions-framework`
- all functions should have their types exported to a separate file
- common functions and types should be placed in `functions/common/<name>`

## Terraform
- avoid duplicating Terraform blocks and rely on function autodiscovery when possible
- pass secrets and environment variables through Terraform, and never store them in the repository

Shared Codex resources in this repository:

- skill: `tools/codex/skills/gcp-backend/SKILL.md`
- local bootstrap script: `tools/codex/setup-codex.sh`

Local setup:

```sh
sh tools/codex/setup-codex.sh
```
