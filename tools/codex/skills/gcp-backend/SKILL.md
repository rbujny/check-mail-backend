# gcp-backend

Use this skill when working on the GCP backend in this repository.

## When to use

- when adding or changing Cloud Functions
- when updating Terraform for function deployment
- when working on JWT, auth, and endpoint integration

## Rules

- add new functions as separate directories under `functions/`
- store deployment configuration in `function.json`
- register the handler through `@google-cloud/functions-framework`
- avoid manually adding separate Terraform resources for each function when autodiscovery is available
- keep `JWT_SECRET` and similar values outside the repository and inject them through environment configuration
