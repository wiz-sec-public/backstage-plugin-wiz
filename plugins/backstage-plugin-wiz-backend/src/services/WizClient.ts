import { createHash } from 'crypto';
import pLimit, { Limit } from 'p-limit';
import { version } from '../../package.json';
import { ISSUES_QUERY } from '../queries/issues';
import { VULNERABILITY_FINDINGS_QUERY } from '../queries/vulnerabilities';
import { ISSUES_SEVERITY_COUNTS_QUERY } from '../queries/issuesCounts';
import { ISSUES_GROUPED_COUNT_QUERY } from '../queries/issuesGrouped';
import { CLOUD_RESOURCES_QUERY } from '../queries/cloudResources';
import { VERSION_CONTROL_RESOURCES_QUERY } from '../queries/versionControlResources';
import {
  type CloudResourcesResponse,
  ErrorHttpStatusMap,
  ErrorTypeMap,
  GraphQLErrorCode,
  type GraphQLResponse,
  type IssuesResponse,
  type IssuesCountsResponse,
  type IssuesGroupedResponse,
  PaginatedResourceResponse,
  type VersionControlResourcesResponse,
  type VulnerabilityFindingsResponse,
  WizError,
  WizErrorType,
} from '../types';
import { WizAuth } from './WizAuth';
import type { Config } from '@backstage/config';
import type {
  CacheService,
  LoggerService,
} from '@backstage/backend-plugin-api';

const INTEGRATION_ID = 'e63efba8-1707-4a4a-a096-e887d27a092c' as const;

const CONFIG_KEYS = {
  CLIENT_ID: 'wiz.clientId',
  CLIENT_SECRET: 'wiz.clientSecret',
  AUTH_URL: 'wiz.authUrl',
  API_ENDPOINT_URL: 'wiz.apiEndpointUrl',
  CACHE_TTL_SECONDS: 'wiz.cacheTtlSeconds',
  MAX_CONCURRENT_REQUESTS: 'wiz.maxConcurrentRequests',
  MAX_RETRIES: 'wiz.maxRetries',
} as const;

const DEFAULT_CACHE_TTL_SECONDS = 300;
const DEFAULT_MAX_CONCURRENT_REQUESTS = 5;
const DEFAULT_MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 30_000;

export interface WizClientOptions {
  cache?: CacheService;
  logger?: LoggerService;
}

export class WizClient {
  private authService: WizAuth;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private readonly apiEndpointUrl: string;
  private readonly clientIdScope: string;
  private readonly cache?: CacheService;
  private readonly logger?: LoggerService;
  private readonly limiter: Limit;
  private readonly cacheTtlMs: number;
  private readonly maxRetries: number;

  constructor(config: Config, options: WizClientOptions = {}) {
    this.authService = new WizAuth(config);
    this.apiEndpointUrl = config.getString(CONFIG_KEYS.API_ENDPOINT_URL);
    this.clientIdScope = config.getString(CONFIG_KEYS.CLIENT_ID);
    this.cache = options.cache;
    this.logger = options.logger;

    const cacheTtlSeconds =
      config.getOptionalNumber(CONFIG_KEYS.CACHE_TTL_SECONDS) ??
      DEFAULT_CACHE_TTL_SECONDS;
    const maxConcurrentRequests =
      config.getOptionalNumber(CONFIG_KEYS.MAX_CONCURRENT_REQUESTS) ??
      DEFAULT_MAX_CONCURRENT_REQUESTS;
    this.maxRetries =
      config.getOptionalNumber(CONFIG_KEYS.MAX_RETRIES) ?? DEFAULT_MAX_RETRIES;

    this.cacheTtlMs = cacheTtlSeconds * 1000;
    this.limiter = pLimit(maxConcurrentRequests);
  }

  private async ensureValidToken(): Promise<void> {
    const tokenExpired =
      this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt;
    if (!this.accessToken || tokenExpired) {
      const tokenResponse = await this.authService.fetchAccessToken();
      this.accessToken = tokenResponse.access_token;
      this.tokenExpiresAt = Date.now() + tokenResponse.expires_in * 1000;
    }
  }

  /**
   * Pipeline order per request:
   *   cache.get → limiter(() => retry(() => fetch)) → cache.set
   *
   * 1. Cache (outermost): a hit returns immediately, never consuming a
   *    concurrency slot or refreshing a token.
   * 2. Limiter wraps retry: the slot is held across retry attempts so a
   *    post-recovery thundering herd cannot re-saturate Wiz.
   * 3. Retry wraps fetch: each attempt is a single fetch with HTTP 429 /
   *    GraphQL RATE_LIMIT_EXCEEDED handling and exponential backoff.
   * 4. Cache is only written on success — error responses (especially
   *    429s) must never be cached.
   */
  private async executeWithPolicies<T>(
    query: string,
    variables: Record<string, unknown>,
    options: { skipCache?: boolean; cacheKeyPrefix?: string } = {},
  ): Promise<T> {
    const { skipCache = false, cacheKeyPrefix = 'wiz:gql' } = options;
    const key = this.cacheKey(cacheKeyPrefix, query, variables);

    if (!skipCache && this.cache) {
      const cached = (await this.cache.get(key)) as T | undefined;
      if (cached !== undefined) {
        return cached;
      }
    }

    const result = await this.limiter(() =>
      this.fetchWithRetry<T>(query, variables),
    );

    if (!skipCache && this.cache) {
      await this.cache.set(key, result as never, { ttl: this.cacheTtlMs });
    }

    return result;
  }

  private async fetchWithRetry<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.makeRequest<T>(query, variables);
      } catch (error) {
        lastError = error;
        if (!this.isRateLimitError(error) || attempt === this.maxRetries) {
          throw error;
        }
        const retryAfterMs = this.extractRetryAfterMs(error);
        const delayMs = this.computeBackoffMs(attempt, retryAfterMs);
        this.logger?.warn('Wiz API rate limit hit; backing off and retrying', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          delayMs,
          retryAfterMs: retryAfterMs ?? null,
        });
        await this.sleep(delayMs);
      }
    }
    // unreachable — the loop either returns or throws
    throw lastError;
  }

  private async makeRequest<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    await this.ensureValidToken();

    try {
      const response = await fetch(this.apiEndpointUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': `${INTEGRATION_ID}/backstage/${version}`,
        },
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        this.handleHttpError(response);
      }

      const data = await response.json();
      return this.handleGraphQLResponse<T>(data);
    } catch (error) {
      this.handleRequestError(error);
    }
  }

  private handleHttpError(response: Response): never {
    if (response.status === 401) {
      throw new WizError(
        WizErrorType.UNAUTHORIZED,
        'Authentication token expired or invalid',
        401,
      );
    }
    if (response.status === 403) {
      throw new WizError(
        WizErrorType.FORBIDDEN,
        'Insufficient permissions',
        403,
      );
    }
    if (response.status === 429) {
      throw new WizError(
        WizErrorType.RATE_LIMITED,
        'Wiz API rate limit exceeded',
        429,
        { retryAfter: response.headers.get('retry-after') ?? undefined },
      );
    }
    throw new WizError(
      WizErrorType.API_ERROR,
      `API request failed: ${response.statusText}`,
      500,
    );
  }

  private handleGraphQLResponse<T>(response: GraphQLResponse<T>): T {
    if (response.errors?.length) {
      const error = response.errors[0];
      const errorCode = error.extensions?.code as GraphQLErrorCode;

      if (!errorCode || !ErrorHttpStatusMap[errorCode]) {
        throw new WizError(
          WizErrorType.API_ERROR,
          error.message || 'Unknown server error',
          500,
        );
      }

      throw new WizError(
        ErrorTypeMap[errorCode],
        error.message || `${errorCode} error occurred`,
        ErrorHttpStatusMap[errorCode],
      );
    }

    if (!response.data) {
      throw new WizError(
        WizErrorType.API_ERROR,
        'Empty response from API',
        500,
      );
    }

    return response.data;
  }

  private handleRequestError(error: unknown): never {
    if (error instanceof WizError) throw error;
    if (error instanceof TypeError) {
      throw new WizError(
        WizErrorType.API_ERROR,
        'Network error while accessing Wiz API',
        500,
      );
    }
    throw new WizError(
      WizErrorType.API_ERROR,
      error instanceof Error ? error.message : 'Unknown error occurred',
      500,
    );
  }

  private isRateLimitError(error: unknown): boolean {
    return (
      error instanceof WizError && error.type === WizErrorType.RATE_LIMITED
    );
  }

  private extractRetryAfterMs(error: unknown): number | undefined {
    if (!(error instanceof WizError)) return undefined;
    const details = error.error as { retryAfter?: string } | undefined;
    const header = details?.retryAfter;
    if (!header) return undefined;
    const asSeconds = Number(header);
    if (Number.isFinite(asSeconds) && asSeconds >= 0) {
      return asSeconds * 1000;
    }
    const asDate = Date.parse(header);
    if (!Number.isNaN(asDate)) {
      return Math.max(0, asDate - Date.now());
    }
    return undefined;
  }

  private computeBackoffMs(
    attempt: number,
    retryAfterMs: number | undefined,
  ): number {
    // Additive jitter, applied outside the cap so it is never clamped away and
    // can only push the delay *later* than Retry-After (retrying before the
    // server's window just burns an attempt on a guaranteed 429). Spreads the
    // lockstep retries of concurrent requests that share one Retry-After and
    // would otherwise re-hit the limit as a thundering herd. See WZ-113816.
    const jitter = Math.random() * BACKOFF_BASE_MS;
    if (retryAfterMs !== undefined) {
      return Math.min(retryAfterMs, BACKOFF_MAX_MS) + jitter;
    }
    const exponential = BACKOFF_BASE_MS * Math.pow(2, attempt);
    return Math.min(exponential + jitter, BACKOFF_MAX_MS);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cacheKey(
    prefix: string,
    query: string,
    variables: Record<string, unknown>,
  ): string {
    const stable = stableStringify(variables);
    const hash = createHash('sha256')
      .update(`${query}|${stable}`)
      .digest('hex');
    return `${prefix}:${this.clientIdScope}:${hash}`;
  }

  async getIssues(
    filters: Record<string, unknown> = {},
    after: string | null = null,
  ): Promise<IssuesResponse> {
    const variables = {
      first: 20,
      after,
      filterBy: {
        status: ['OPEN', 'IN_PROGRESS'],
        ...filters,
      },
      orderBy: { direction: 'DESC', field: 'SEVERITY' },
    };

    return this.executeWithPolicies<IssuesResponse>(ISSUES_QUERY, variables);
  }

  async getVulnerabilityFindings(
    filters: Record<string, unknown> = {},
    after: string | null = null,
  ): Promise<VulnerabilityFindingsResponse> {
    const variables = {
      first: 20,
      after,
      filterBy: {
        status: ['OPEN'],
        ...filters,
      },
      orderBy: { direction: 'DESC', field: 'RELATED_ISSUE_SEVERITY' },
    };

    return this.executeWithPolicies<VulnerabilityFindingsResponse>(
      VULNERABILITY_FINDINGS_QUERY,
      variables,
    );
  }

  async getIssuesSeverityCounts(
    filters: Record<string, unknown> = {},
  ): Promise<IssuesCountsResponse> {
    const variables = {
      filterBy: {
        status: ['OPEN', 'IN_PROGRESS'],
        ...filters,
      },
    };

    return this.executeWithPolicies<IssuesCountsResponse>(
      ISSUES_SEVERITY_COUNTS_QUERY,
      variables,
    );
  }

  async getIssuesGroupedCount(
    filters: Record<string, unknown> = {},
  ): Promise<IssuesGroupedResponse> {
    const variables = {
      groupBy: 'RESOURCE',
      filterBy: {
        status: ['OPEN', 'IN_PROGRESS'],
        ...filters,
      },
    };

    return this.executeWithPolicies<IssuesGroupedResponse>(
      ISSUES_GROUPED_COUNT_QUERY,
      variables,
    );
  }

  async getAllCloudResources(
    filters: Record<string, unknown> = {},
  ): Promise<CloudResourcesResponse> {
    return this.fetchPaginatedResources<{ id: string }, 'cloudResources'>(
      CLOUD_RESOURCES_QUERY,
      'cloudResources',
      filters,
    );
  }

  async getVersionControlResources(
    filters: Record<string, unknown> = {},
  ): Promise<VersionControlResourcesResponse> {
    return this.fetchPaginatedResources<
      { id: string },
      'versionControlResources'
    >(VERSION_CONTROL_RESOURCES_QUERY, 'versionControlResources', filters);
  }

  /**
   * Paginated walks cache the aggregated final result keyed on (query +
   * user filters), not per-page cursor results. Inner per-page calls
   * bypass the request-level cache (their `after` cursors are unstable
   * across requests) but still go through the concurrency limiter and
   * retry policy.
   *
   * For filtered queries (e.g. `providerUniqueId`), the response is
   * expected to fit in a single page of pageSize=500. The loop exists
   * only as a safety net for unfiltered queries.
   */
  private async fetchPaginatedResources<
    T extends { id: string },
    K extends string,
  >(
    query: string,
    resourceKey: K,
    filters: Record<string, unknown> = {},
    maxResults: number = 10000,
    pageSize: number = 500,
  ): Promise<{ data: Record<K, PaginatedResourceResponse<T>> }> {
    const aggregateKey = this.cacheKey('wiz:gql-paginated', query, {
      resourceKey,
      filters,
      pageSize,
    });

    if (this.cache) {
      const cached = (await this.cache.get(aggregateKey)) as
        | { data: Record<K, PaginatedResourceResponse<T>> }
        | undefined;
      if (cached !== undefined) {
        return cached;
      }
    }

    await this.ensureValidToken();

    let allNodes: T[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    let totalFetched = 0;

    while (hasNextPage) {
      const variables: {
        first: number;
        after: string | null;
        filterBy: Record<string, unknown>;
      } = {
        first: pageSize,
        after,
        filterBy: filters,
      };

      const response = await this.executeWithPolicies<
        Record<K, PaginatedResourceResponse<T>>
      >(query, variables, { skipCache: true });

      const resourceData: PaginatedResourceResponse<T> | undefined =
        response[resourceKey];

      if (!resourceData?.nodes) {
        throw new WizError(
          WizErrorType.API_ERROR,
          'Invalid response format from Wiz API',
          500,
        );
      }

      allNodes = [...allNodes, ...resourceData.nodes];
      totalFetched += resourceData.nodes.length;

      hasNextPage = resourceData.pageInfo.hasNextPage;
      after = resourceData.pageInfo.endCursor;

      if (totalFetched >= maxResults) {
        throw new WizError(
          WizErrorType.API_ERROR,
          'Too many results returned. Please refine your search criteria.',
          400,
        );
      }
    }

    const aggregated = {
      data: {
        [resourceKey]: {
          nodes: allNodes,
          pageInfo: {
            hasNextPage: false,
            endCursor: after || '',
          },
        },
      } as Record<K, PaginatedResourceResponse<T>>,
    };

    if (this.cache) {
      await this.cache.set(aggregateKey, aggregated as never, {
        ttl: this.cacheTtlMs,
      });
    }

    return aggregated;
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    k =>
      `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(',')}}`;
}
