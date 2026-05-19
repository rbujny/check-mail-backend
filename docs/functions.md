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

## API Gateway routes

Public API routes are defined by the OpenAPI template in `infra/openapi/checkmail.yaml.tftpl` and deployed through API Gateway.

When adding a new public endpoint, add the backend function as usual and then add a gateway path that uses `x-google-backend` to route to the function URL. Existing functions expose their Express app at `/`, so gateway paths should use `path_translation: CONSTANT_ADDRESS` unless the function intentionally handles nested paths.

Gateway routes require a valid Checkmail JWT by default. Use method-level `security: []` only for intentionally public endpoints such as token issuance, JWKS discovery, or CORS preflight.

## Secrets and configuration

- keep secrets outside the repository
- inject environment variables through Terraform
- document new required environment variables in `README.md`
