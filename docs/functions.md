# Functions Conventions

This document defines the conventions for HTTP Cloud Functions in this repository.

## Required structure

Each function must live in `functions/<name>` and include:

- `function.json`
- `package.json`
- `tsconfig.json`
- `src/index.ts`

## HTTP wrapper

All HTTP Cloud Functions must be wrapped in an Express application and then registered through `@google-cloud/functions-framework`.

Expected pattern:

1. Create an Express app in `src/index.ts`
2. Attach middleware such as JSON parsing, CORS headers, and error handling in the Express layer
3. Register the app through `http("<entryPoint>", app)`

## Types

All function-specific types must be exported from a dedicated file such as `src/types.ts`.

Examples:

- request body types
- response payload types
- domain-specific payload types

## Shared code

Reusable functions and shared types that are used by more than one function should be placed in `functions/common/<name>`.

Use local function files for logic that is specific to a single endpoint.

## Secrets and configuration

- keep secrets outside the repository
- store deployment secrets in GitHub Secrets and inject them through the manual deployment workflow and Terraform
- document new required environment variables in `README.md`

## Local development

Run functions locally only for development and debugging:

```sh
cd functions/<name>
npm install
npm run start
```

Shared infrastructure deployments must go through the manual GitHub Actions deployment workflow.
