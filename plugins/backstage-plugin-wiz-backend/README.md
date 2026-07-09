# Wiz Backend Plugin for Backstage

This plugin provides backend functionality for integrating Wiz security information into your Backstage instance.

## Features

- Fetch and display Wiz issues
- Access vulnerability findings
- Query issue statistics and severity counts
- Support for cloud resources and version control repositories
- Built-in authentication and error handling for Wiz API
- Response caching, request concurrency limiting, and automatic retry with
  backoff on Wiz API rate limits (HTTP 429), so large catalogs render
  reliably without exhausting the tenant rate limit

## Installation

### Add the Backend Plugin

```bash
# From your Backstage root directory
yarn --cwd packages/backend add @wiz-sec/backstage-plugin-wiz-backend
```

## Configuration

Add the following to your `packages/backend/src/index.ts`:

```typescript

...
import { createBackend } from '@backstage/backend-defaults';
const backend = createBackend();

backend.add(import ('@wiz-sec/backstage-plugin-wiz-backend'));
...
```

Add the following to your `app-config.yaml`:

```yaml
wiz:
  clientId: ${WIZ_CLIENT_ID}
  clientSecret: ${WIZ_CLIENT_SECRET}
  authUrl: ${WIZ_AUTH_URL}
  apiEndpointUrl: ${WIZ_API_URL}
```

Required environment variables:

- `WIZ_CLIENT_ID`: Your Wiz service account client ID
- `WIZ_CLIENT_SECRET`: Your Wiz service account client secret
- `WIZ_AUTH_URL`: Authentication URL for Wiz API (typically 'https://auth.app.wiz.io/oauth/token')
- `WIZ_API_URL`: Wiz API endpoint URL

### Performance & rate-limit tuning (optional)

To keep large Backstage catalogs from exhausting the Wiz tenant rate limit, the
backend caches GraphQL responses, caps concurrent requests, and retries on
rate-limit responses with backoff. All three are optional and have sensible
defaults:

```yaml
wiz:
  # ...credentials above...
  cacheTtlSeconds: 300 # cache Wiz responses for 5 minutes (default: 300)
  maxConcurrentRequests: 5 # max in-flight Wiz requests per backend (default: 5)
  maxRetries: 3 # retries on HTTP 429 / RATE_LIMIT_EXCEEDED (default: 3)
```

- `cacheTtlSeconds`: how long to cache Wiz GraphQL responses. Lower it for
  fresher data, raise it to reduce API load. Set via the standard Backstage
  cache service — responses are stored in-memory by default; configure
  `backend.cache` (e.g. Redis) to share the cache across multiple backend
  replicas.
- `maxConcurrentRequests`: upper bound on simultaneous Wiz GraphQL calls per
  backend instance.
- `maxRetries`: retry attempts when Wiz returns HTTP 429 or a
  `RATE_LIMIT_EXCEEDED` GraphQL error. The plugin honors the `Retry-After`
  header when present, otherwise uses exponential backoff with jitter. After
  retries are exhausted the request fails with a `RATE_LIMITED` error.

## API Endpoints

The plugin exposes the following endpoints:

### GET /wiz-issues

Fetches issues based on provided filters.

Query parameters:

- `project`: Filter by project ID
- `relatedEntity`: Filter by related entity information
- `search`: Search term for filtering issues

### GET /wiz-vulnerabilities

Fetches vulnerability findings.

Query parameters:

- `projectId`: Filter by project ID
- `assetId`: Filter by asset ID
- `vulnerabilityExternalId`: Filter by external vulnerability ID

### GET /wiz-issues-stats

Fetches issue statistics including severity counts and grouped counts.

Query parameters:

- Same as /wiz-issues

## Error Handling

The plugin implements comprehensive error handling with the following error types:

- `MISSING_CONFIG`: Configuration error
- `UNAUTHORIZED`: Authentication error
- `FORBIDDEN`: Permission error
- `API_ERROR`: General API error
- `INVALID_REQUEST`: Invalid request error
- `RATE_LIMITED`: Wiz API rate limit hit (HTTP 429) and exhausted retries;
  returned with HTTP status 429 so the frontend can show a distinct
  "rate limit reached" state instead of a generic error
