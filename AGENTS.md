# AGENTS.md

Collaboration rules for this repository:

## General rules
- update `README.md` when backend behavior, usage, or deployment changes
- write all `.md` files in English
- all documentation should be placed in `/docs`
- keep `docs/backend-status.local.md` updated after every repository change that adds, removes, or modifies backend functionality so it remains the current local work-status reference

## Functions
- keep new Cloud Functions in `functions/<name>`
- each function should include `function.json`, `package.json`, `tsconfig.json`, and `src/index.ts`
- wrap all HTTP functions in an Express app and register them through `@google-cloud/functions-framework`
- all function-specific types should be exported from a dedicated file such as `src/types.ts`
- reusable functions and shared types should be placed in `functions/common/<name>` when used by more than one function

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
