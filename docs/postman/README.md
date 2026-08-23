# Postman API Test Suite

The Postman assets in this directory exercise the deployed CheckMail API through GCP API Gateway.

## Files

- `checkmail-backend.postman_collection.json` - requests and assertions
- `checkmail-backend.postman_environment.json` - environment template without credentials

## Configuration

Import both files into Postman and select the imported environment. Set its current values:

- `baseUrl` - API Gateway origin without a trailing slash, for example `https://checkmail-gateway-...ew.gateway.dev`
- `apiKey` - value returned by `terraform output -raw api_gateway_client_key`
- `subject` - arbitrary test-client identifier
- `maxResponseTimeMs` - response-time assertion threshold; defaults to 10000 ms

Leave `jwtToken` empty. The first request populates it. Do not export or commit an environment after filling in `apiKey` or `jwtToken`.

The gateway hostname is available from:

```sh
terraform output -raw api_gateway_default_hostname
```

Prefix it with `https://` when setting `baseUrl`.

## Interactive run

Use Collection Runner and execute folders in numeric order:

1. `00 Authentication` obtains and stores a JWT.
2. `01 Heuristic classifications` verifies representative `OK`, `WARNING`, and `PHISHING` decisions.
3. `02 Contract validation` verifies malformed and out-of-contract requests.
4. `03 Gateway security and routing` verifies JWT, API-key, method, and route enforcement.

The classification tests intentionally assert selected full comments in addition to result enums. A changed rule weight, ordering, or explanation can therefore surface as a regression.

## Newman

Install Newman outside this repository, then run:

```sh
newman run docs/postman/checkmail-backend.postman_collection.json \
  --environment docs/postman/checkmail-backend.postman_environment.json \
  --folder "00 Authentication" \
  --folder "01 Heuristic classifications" \
  --folder "02 Contract validation" \
  --folder "03 Gateway security and routing" \
  --export-environment /tmp/checkmail-postman-runtime.json
```

The environment template contains empty credentials, so pass real values through a private environment copy or Newman environment variables. Never commit the generated runtime environment.

## Rate-limit test

Rate limiting is separated because it intentionally sends many requests and can affect other test runs. First obtain a token and export the runtime environment:

```sh
newman run docs/postman/checkmail-backend.postman_collection.json \
  --environment /path/to/private-checkmail-environment.json \
  --folder "00 Authentication" \
  --export-environment /tmp/checkmail-postman-runtime.json
```

Then run the quota probe rapidly for 65 iterations:

```sh
newman run docs/postman/checkmail-backend.postman_collection.json \
  --environment /tmp/checkmail-postman-runtime.json \
  --folder "04 Rate limiting (manual runner)" \
  --iteration-count 65
```

The final iteration asserts that at least one request returned `429`. API Gateway quota accounting can be delayed or cached; if the assertion does not trigger, increase the iteration count or rerun immediately while staying within an authorized test environment.

## Scope

The suite covers:

- JWT acquisition and token contract
- API-key and JWT enforcement
- representative authentication-verdict combinations
- sender, Reply-To, and link-domain mismatches
- IP, HTTP, userinfo, punycode, and non-standard-port link signals
- Polish urgency and credential language
- required fields, unsupported fields, enum validation, malformed JSON, body length, and link-count limits
- unsupported methods and routes
- manual process-endpoint quota verification

It does not validate Cloud Logging contents, Firestore, Cloud SQL, external reputation data, or browser-extension integration.
