import { WizClient } from './WizClient';
import {
  WizErrorType,
  IssuesResponse,
  VulnerabilitiesResponse,
  IssuesStatsResponse,
  CloudResourcesResponse,
  VersionControlResourcesResponse,
} from '../types';
import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

describe('WizClient', () => {
  const mockDiscoveryApi: jest.Mocked<DiscoveryApi> = {
    getBaseUrl: jest.fn().mockResolvedValue('http://localhost'),
  };

  const mockFetchApi: jest.Mocked<FetchApi> = {
    fetch: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const client = new WizClient({
    discoveryApi: mockDiscoveryApi,
    fetchApi: mockFetchApi,
  });

  const createMockResponse = <T>(
    data: T,
    ok = true,
    status = 200,
  ): Response => {
    return new Response(JSON.stringify(data), {
      status,
      statusText: ok ? 'OK' : 'Error',
      headers: new Headers({ 'Content-Type': 'application/json' }),
    });
  };

  describe('fetchIssues', () => {
    it('handles successful API response', async () => {
      const mockResponse: IssuesResponse = {
        issues: {
          nodes: [
            {
              id: '1',
              url: 'http://example.com',
              sourceRule: {
                id: 'rule-1',
                name: 'Test Rule',
              },
              createdAt: '2024-01-01T00:00:00Z',
              type: 'SECURITY',
              status: 'OPEN',
              severity: 'HIGH',
              entitySnapshot: {
                id: 'snap-1',
                name: 'test-entity',
                type: 'AWS',
              },
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: '',
          },
          totalCount: 1,
        },
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(mockResponse),
      );

      const result = await client.fetchIssues();
      expect(result).toEqual(mockResponse);
      expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith(
        'backstage-plugin-wiz',
      );
    });

    it('handles pagination parameters', async () => {
      const mockResponse: IssuesResponse = {
        issues: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: '',
          },
          totalCount: 0,
        },
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(mockResponse),
      );
      await client.fetchIssues({ projectId: ['test'] }, 'cursor123');

      const url = mockFetchApi.fetch.mock.calls[0][0] as string;
      expect(url).toContain('projectId=test');
      expect(url).toContain('after=cursor123');
    });

    it('handles network error', async () => {
      mockFetchApi.fetch.mockRejectedValueOnce(
        new TypeError('Failed to fetch'),
      );
      await expect(client.fetchIssues()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('fetchVulnerabilities', () => {
    it('handles successful vulnerability fetch', async () => {
      const mockResponse: VulnerabilitiesResponse = {
        vulnerabilityFindings: {
          nodes: [
            {
              id: '1',
              vulnerabilityExternalId: 'CVE-2024-1234',
              portalUrl: 'http://example.com',
              name: 'Test Vulnerability',
              CVSSSeverity: 'HIGH',
              hasExploit: false,
              hasCisaKevExploit: false,
              status: 'OPEN',
              vendorSeverity: 'HIGH',
              firstDetectedAt: '2024-01-01T00:00:00Z',
              lastDetectedAt: '2024-01-01T00:00:00Z',
              vulnerableAsset: {
                id: 'asset-1',
                type: 'CONTAINER',
                name: 'test-container',
                providerUniqueId: 'test-id',
              },
              relatedIssueAnalytics: {
                issueCount: 1,
                criticalSeverityCount: 0,
                highSeverityCount: 1,
                mediumSeverityCount: 0,
                lowSeverityCount: 0,
                informationalSeverityCount: 0,
              },
            },
          ],
          pageInfo: {
            hasNextPage: false,
            endCursor: '',
          },
          totalCount: 1,
        },
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(mockResponse),
      );

      const result = await client.fetchVulnerabilities();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('error handling', () => {
    it('handles unauthorized error', async () => {
      const errorResponse = {
        type: WizErrorType.UNAUTHORIZED,
        message: 'Unauthorized',
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(errorResponse, false, 401),
      );

      await expect(client.fetchIssues()).rejects.toThrow(
        'Authentication failed with Wiz API',
      );
    });

    it('handles forbidden error', async () => {
      const errorResponse = {
        type: WizErrorType.FORBIDDEN,
        message: 'Forbidden',
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(errorResponse, false, 403),
      );

      await expect(client.fetchIssues()).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('handles missing config error', async () => {
      const errorResponse = {
        type: WizErrorType.MISSING_CONFIG,
        message: 'Missing configuration',
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(errorResponse, false, 400),
      );

      await expect(client.fetchIssues()).rejects.toThrow(
        'not properly configured',
      );
    });
  });

  describe('fetchIssuesStats', () => {
    it('handles successful stats fetch', async () => {
      const mockResponse: IssuesStatsResponse = {
        severityCounts: {
          issues: {
            totalCount: 10,
            criticalSeverityCount: 2,
            highSeverityCount: 3,
            mediumSeverityCount: 3,
            lowSeverityCount: 2,
            informationalSeverityCount: 0,
          },
        },
        groupedCounts: {
          issuesGroupedByValue: {
            totalCount: 10,
          },
        },
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(mockResponse),
      );

      const result = await client.fetchIssuesStats();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchCloudResources', () => {
    it('handles successful cloud resources fetch', async () => {
      const mockResponse: CloudResourcesResponse = {
        data: {
          cloudResources: {
            nodes: [{ id: '1' }],
            pageInfo: {
              hasNextPage: false,
              endCursor: '',
            },
          },
        },
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(mockResponse),
      );

      const result = await client.fetchCloudResources();
      expect(result).toEqual(mockResponse);
    });
  });

  describe('fetchVersionControlResources', () => {
    it('handles successful version control resources fetch', async () => {
      const mockResponse: VersionControlResourcesResponse = {
        data: {
          versionControlResources: {
            nodes: [{ id: '1' }],
            pageInfo: {
              hasNextPage: false,
              endCursor: '',
            },
          },
        },
      };

      mockFetchApi.fetch.mockResolvedValueOnce(
        createMockResponse(mockResponse),
      );

      const result = await client.fetchVersionControlResources();
      expect(result).toEqual(mockResponse);
    });
  });
});
