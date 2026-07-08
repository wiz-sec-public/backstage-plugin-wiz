import type { Config } from '@backstage/config';
import type {
  CacheService,
  LoggerService,
} from '@backstage/backend-plugin-api';
import { WizClient } from './WizClient';
import { WizAuth } from './WizAuth';
import { WizError, WizErrorType } from '../types';

jest.mock('./WizAuth');

const originalFetch = global.fetch;

function createMockConfig(
  overrides: Partial<Record<string, string | number>> = {},
): jest.Mocked<Config> {
  const values: Record<string, string | number> = {
    'wiz.clientId': 'test-client-id',
    'wiz.clientSecret': 'test-client-secret',
    'wiz.authUrl': 'https://test.auth.url',
    'wiz.apiEndpointUrl': 'https://test.api.url',
    ...overrides,
  };
  return {
    getString: jest.fn((key: string) => {
      const v = values[key];
      if (typeof v !== 'string') {
        throw new Error(`Unexpected config key: ${key}`);
      }
      return v;
    }),
    getOptionalNumber: jest.fn((key: string) => {
      const v = values[key];
      return typeof v === 'number' ? v : undefined;
    }),
    has: jest.fn(),
    keys: jest.fn(),
    get: jest.fn(),
    getBoolean: jest.fn(),
    getConfig: jest.fn(),
    getConfigArray: jest.fn(),
    getNumber: jest.fn(),
    getOptional: jest.fn(),
    getOptionalBoolean: jest.fn(),
    getOptionalConfig: jest.fn(),
    getOptionalConfigArray: jest.fn(),
    getOptionalString: jest.fn(),
    getOptionalStringArray: jest.fn(),
    getStringArray: jest.fn(),
  } as jest.Mocked<Config>;
}

function createMockCache(): jest.Mocked<CacheService> {
  return {
    get: jest.fn().mockResolvedValue(undefined),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    withOptions: jest.fn(),
  } as unknown as jest.Mocked<CacheService>;
}

function createMockLogger(): LoggerService {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: () => createMockLogger(),
  };
}

function mockFetchResponse({
  status = 200,
  body = {},
  headers = {},
}: {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `Status ${status}`,
    headers: new Headers(headers),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const issuesData = {
  data: {
    issues: {
      totalCount: 0,
      nodes: [],
      pageInfo: { hasNextPage: false, endCursor: '' },
    },
  },
};

describe('WizClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    (WizAuth as jest.MockedClass<typeof WizAuth>).prototype.fetchAccessToken =
      jest
        .fn()
        .mockResolvedValue({ access_token: 'token-123', expires_in: 3600 });
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  describe('cache', () => {
    it('returns cached responses without fetching when cache hits', async () => {
      const cache = createMockCache();
      (cache.get as jest.Mock).mockResolvedValueOnce(issuesData);
      const client = new WizClient(createMockConfig(), { cache });

      const result = await client.getIssues({ project: ['p1'] });

      expect(result).toEqual(issuesData);
      expect(cache.get).toHaveBeenCalledTimes(1);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('writes to cache after a successful fetch', async () => {
      const cache = createMockCache();
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ body: issuesData }));
      const client = new WizClient(createMockConfig(), { cache });

      await client.getIssues();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cache.set).toHaveBeenCalledTimes(1);
      const [key, value, options] = (cache.set as jest.Mock).mock.calls[0];
      expect(key).toMatch(/^wiz:gql:test-client-id:/);
      expect(value).toEqual(issuesData.data);
      expect(options).toEqual({ ttl: 300_000 });
    });

    it('does not cache error responses', async () => {
      const cache = createMockCache();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          status: 500,
          body: {},
        }),
      );
      const client = new WizClient(createMockConfig(), { cache });

      await expect(client.getIssues()).rejects.toBeInstanceOf(WizError);
      expect(cache.set).not.toHaveBeenCalled();
    });

    it('honors configured cache TTL', async () => {
      const cache = createMockCache();
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ body: issuesData }));
      const client = new WizClient(
        createMockConfig({ 'wiz.cacheTtlSeconds': 60 }),
        { cache },
      );

      await client.getIssues();

      const [, , options] = (cache.set as jest.Mock).mock.calls[0];
      expect(options).toEqual({ ttl: 60_000 });
    });
  });

  describe('retry on rate limit', () => {
    it('retries HTTP 429 and returns success', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({
            status: 429,
            headers: { 'retry-after': '1' },
          }),
        )
        .mockResolvedValueOnce(mockFetchResponse({ body: issuesData }));
      const client = new WizClient(createMockConfig(), {
        logger: createMockLogger(),
      });

      const promise = client.getIssues();
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(issuesData.data);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries GraphQL RATE_LIMIT_EXCEEDED and returns success', async () => {
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({
            body: {
              errors: [
                {
                  message: 'rate limited',
                  extensions: { code: 'RATE_LIMIT_EXCEEDED' },
                },
              ],
            },
          }),
        )
        .mockResolvedValueOnce(mockFetchResponse({ body: issuesData }));
      const client = new WizClient(createMockConfig(), {
        logger: createMockLogger(),
      });

      const promise = client.getIssues();
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(issuesData.data);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws RATE_LIMITED WizError after max retries exhausted', async () => {
      const rateLimited = mockFetchResponse({
        status: 429,
        headers: { 'retry-after': '1' },
      });
      fetchMock.mockResolvedValue(rateLimited);

      const client = new WizClient(createMockConfig({ 'wiz.maxRetries': 2 }), {
        logger: createMockLogger(),
      });

      const promise = client.getIssues().catch(e => e);
      await jest.runAllTimersAsync();
      const error = await promise;

      expect(error).toBeInstanceOf(WizError);
      expect((error as WizError).type).toBe(WizErrorType.RATE_LIMITED);
      expect((error as WizError).statusCode).toBe(429);
      // initial attempt + 2 retries
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('adds jitter on top of Retry-After so retries do not fire in lockstep', async () => {
      // Deterministic jitter: 0.5 * BACKOFF_BASE_MS (500ms) = 250ms.
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const logger = createMockLogger();
      fetchMock
        .mockResolvedValueOnce(
          mockFetchResponse({
            status: 429,
            headers: { 'retry-after': '1' },
          }),
        )
        .mockResolvedValueOnce(mockFetchResponse({ body: issuesData }));
      const client = new WizClient(createMockConfig(), { logger });

      const promise = client.getIssues();
      await jest.runAllTimersAsync();
      await promise;

      // Retry-After of 1s honored (1000ms), then jitter added on top: the delay
      // lands strictly after the server's window, never before it.
      expect(logger.warn).toHaveBeenCalledWith(
        'Wiz API rate limit hit; backing off and retrying',
        expect.objectContaining({ delayMs: 1250, retryAfterMs: 1000 }),
      );
      randomSpy.mockRestore();
    });

    it('does not retry non-rate-limit errors', async () => {
      fetchMock.mockResolvedValueOnce(mockFetchResponse({ status: 500 }));
      const client = new WizClient(createMockConfig(), {
        logger: createMockLogger(),
      });

      await expect(client.getIssues()).rejects.toBeInstanceOf(WizError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('concurrency limit', () => {
    it('caps concurrent in-flight requests', async () => {
      jest.useRealTimers();
      let inFlight = 0;
      let maxInFlight = 0;
      fetchMock.mockImplementation(async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise(resolve => setTimeout(resolve, 10));
        inFlight -= 1;
        return mockFetchResponse({ body: issuesData });
      });

      const client = new WizClient(
        createMockConfig({ 'wiz.maxConcurrentRequests': 2 }),
      );

      const promises = Array.from({ length: 6 }, (_, i) =>
        client.getIssues({ filter: [`f${i}`] }),
      );

      await Promise.all(promises);

      expect(maxInFlight).toBeLessThanOrEqual(2);
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });
  });

  describe('paginated cache', () => {
    it('caches the aggregated paginated result', async () => {
      const cache = createMockCache();
      fetchMock.mockResolvedValueOnce(
        mockFetchResponse({
          body: {
            data: {
              cloudResources: {
                nodes: [{ id: 'r1' }],
                pageInfo: { hasNextPage: false, endCursor: '' },
              },
            },
          },
        }),
      );
      const client = new WizClient(createMockConfig(), { cache });

      await client.getAllCloudResources({ providerUniqueId: ['x'] });

      const setCalls = (cache.set as jest.Mock).mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      const paginatedSet = setCalls.find(([key]) =>
        String(key).startsWith('wiz:gql-paginated:'),
      );
      expect(paginatedSet).toBeDefined();
    });

    it('returns the aggregated cached value without re-fetching', async () => {
      const cache = createMockCache();
      const cached = {
        data: {
          cloudResources: {
            nodes: [{ id: 'cached' }],
            pageInfo: { hasNextPage: false, endCursor: '' },
          },
        },
      };
      (cache.get as jest.Mock).mockImplementation((key: string) =>
        Promise.resolve(
          key.startsWith('wiz:gql-paginated:') ? cached : undefined,
        ),
      );
      const client = new WizClient(createMockConfig(), { cache });

      const result = await client.getAllCloudResources({
        providerUniqueId: ['x'],
      });

      expect(result).toEqual(cached);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
