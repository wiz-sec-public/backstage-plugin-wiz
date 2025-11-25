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

const INTEGRATION_ID = 'e63efba8-1707-4a4a-a096-e887d27a092c' as const;

const CONFIG_KEYS = {
  CLIENT_ID: 'wiz.clientId',
  CLIENT_SECRET: 'wiz.clientSecret',
  AUTH_URL: 'wiz.authUrl',
  API_ENDPOINT_URL: 'wiz.apiEndpointUrl',
} as const;

export class WizClient {
  private authService: WizAuth;
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private readonly apiEndpointUrl: string;

  constructor(config: Config) {
    this.authService = new WizAuth(config);
    this.apiEndpointUrl = config.getString(CONFIG_KEYS.API_ENDPOINT_URL);
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

    return this.makeRequest<IssuesResponse>(ISSUES_QUERY, variables);
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

    return this.makeRequest<VulnerabilityFindingsResponse>(
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

    return this.makeRequest<IssuesCountsResponse>(
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

    return this.makeRequest<IssuesGroupedResponse>(
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

      const response = await this.makeRequest<
        Record<K, PaginatedResourceResponse<T>>
      >(query, variables);

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

    return {
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
  }
}
