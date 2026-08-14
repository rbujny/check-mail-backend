# Pull Request Checks

Pull requests run the `.github/workflows/pr-checks.yml` workflow.

## Terraform

The Terraform job runs:

- `terraform fmt -check -recursive infra`
- `terraform init -backend=false -input=false`
- `terraform validate -no-color`
- `tflint --chdir=infra --recursive --format compact`

PR checks and the manual deployment workflow use Terraform 1.14.6.

The workflow initializes Terraform without the remote backend, so PR validation does not need access to the GCS state bucket.

## Prettier

The Prettier job installs the root development tooling with `npm ci` and runs:

```sh
npm run format:check
```

Run `npm run format` locally before opening a pull request when Markdown, YAML, JSON, or TypeScript files change.

## Cloud Functions

The Cloud Functions job discovers every `functions/*/package.json` file, installs dependencies, and runs:

```sh
npm --prefix <function-directory> run build
```

Each function should keep its `build` script wired to TypeScript compilation so PR checks catch type errors before deployment.

## Deployment

PR checks never deploy infrastructure. Shared infrastructure is deployed only by manually running `.github/workflows/deploy.yml` after changes are merged and the required GitHub Secrets are configured.
