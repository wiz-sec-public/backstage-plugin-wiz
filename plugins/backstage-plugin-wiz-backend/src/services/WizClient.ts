import { version } from '../../package.json';
import { ISSUES_QUERY } from '../queries/issues';
import { VULNERABILITY_FINDINGS_QUERY } from '../queries/vulnerabilities';
import { ISSUES_SEVERITY_COUNTS_QUERY } from '../queries/issuesCounts';
import { ISSUES_GROUPED_COUNT_QUERY } from '../queries/issuesGrouped';
import { CLOUD_RESOURCES_QUERY } from '../queries/cloudResources';
import { VERSION_CONTROL_RESOURCES_QUERY } from '../queries/versionControlResources';
import { GRAPH_SEARCH_QUERY } from '../queries/graphSearch';
import {
  type CloudResourcesResponse,
  ErrorHttpStatusMap,
  ErrorTypeMap,
  GraphQLErrorCode,
  type GraphQLResponse,
  type GraphSearchData,
  type GraphSearchEntity,
  type IssuesResponse,
  type IssuesCountsResponse,
  type IssuesGroupedResponse,
  PaginatedResourceResponse,
  type VersionControlResourcesResponse,
  type VulnerabilityFindingsData,
  type VulnerabilityFindingsResponse,
  WizError,
  WizErrorType,
} from '../types';
import { WizAuth } from './WizAuth';
import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';

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
  private readonly logger: LoggerService;

  constructor(config: Config, logger: LoggerService) {
    this.authService = new WizAuth(config);
    this.apiEndpointUrl = config.getString(CONFIG_KEYS.API_ENDPOINT_URL);
    this.logger = logger;
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

    // Extract the query operation name for cleaner logs
    const operationName =
      query.match(/^\s*query\s+(\w+)/)?.[1] ?? 'UnknownQuery';
    this.logger.debug(
      `Wiz GraphQL request: ${operationName}`,
      { variables: JSON.stringify(variables, null, 2) },
    );

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
    // Guard: Wiz API rejects unscoped vulnerability queries (no projectId or assetId)
    const hasProjectId = filters.projectId && (Array.isArray(filters.projectId) ? filters.projectId.length > 0 : true);
    const hasAssetId = filters.assetId && (Array.isArray(filters.assetId) ? filters.assetId.length > 0 : true);
    const hasVulnId = filters.vulnerabilityExternalId && (Array.isArray(filters.vulnerabilityExternalId) ? filters.vulnerabilityExternalId.length > 0 : true);

    if (!hasProjectId && !hasAssetId && !hasVulnId) {
      this.logger.debug('Skipping vulnerability query: no scoping filters provided');
      return {
        data: {
          vulnerabilityFindings: {
            totalCount: 0,
            nodes: [],
            pageInfo: { hasNextPage: false, endCursor: '' },
          },
        },
      } as unknown as VulnerabilityFindingsResponse;
    }

    const MAX_ASSET_IDS_PER_REQUEST = 100;
    const assetIds = Array.isArray(filters.assetId)
      ? (filters.assetId as string[])
      : undefined;

    // If assetId count is within limits, make a single request
    if (!assetIds || assetIds.length <= MAX_ASSET_IDS_PER_REQUEST) {
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

    // Batch mode: split asset IDs into chunks to avoid Wiz API limits
    this.logger.info(
      `Batching vulnerability query: ${assetIds.length} asset IDs in ${Math.ceil(assetIds.length / MAX_ASSET_IDS_PER_REQUEST)} batches`,
    );

    const batches: string[][] = [];
    for (let i = 0; i < assetIds.length; i += MAX_ASSET_IDS_PER_REQUEST) {
      batches.push(assetIds.slice(i, i + MAX_ASSET_IDS_PER_REQUEST));
    }

    const results = await Promise.all(
      batches.map(batch => {
        const batchFilters = { ...filters, assetId: batch };
        const variables = {
          first: 500,
          after: null,
          filterBy: { status: ['OPEN'], ...batchFilters },
          orderBy: { direction: 'DESC', field: 'RELATED_ISSUE_SEVERITY' },
        };
        return this.makeRequest<VulnerabilityFindingsResponse>(
          VULNERABILITY_FINDINGS_QUERY,
          variables,
        );
      }),
    );

    // Merge and deduplicate results from all batches
    const seenIds = new Set<string>();
    const allNodes: VulnerabilityFindingsData['vulnerabilityFindings']['nodes'] =
      [];
    let totalCount = 0;

    for (const result of results) {
      const data = result as unknown as VulnerabilityFindingsData;
      totalCount += data.vulnerabilityFindings.totalCount;
      for (const node of data.vulnerabilityFindings.nodes) {
        if (!seenIds.has(node.id)) {
          seenIds.add(node.id);
          allNodes.push(node);
        }
      }
    }

    // Sort by severity (most critical first)
    const severityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
      INFORMATIONAL: 4,
      NONE: 5,
    };
    allNodes.sort(
      (a, b) =>
        (severityOrder[a.CVSSSeverity] ?? 99) -
        (severityOrder[b.CVSSSeverity] ?? 99),
    );

    return {
      vulnerabilityFindings: {
        totalCount,
        nodes: allNodes,
        pageInfo: {
          hasNextPage: false,
          endCursor: '',
        },
      },
    } as unknown as VulnerabilityFindingsResponse;
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

  async getGraphSearchEntities(
    kubernetesAnnotations: Array<{ key: string; value: string }>,
    projectId: string = '*',
  ): Promise<{ entityIds: string[]; containerImageIds: string[] }> {
    const whereConditions = kubernetesAnnotations.map(ann => ({
      annotations: { CONTAINS: [`"${ann.key}":"${ann.value}"`] },
    }));

    const queryInput = {
      type: ['KUBERNETES_RESOURCE'],
      select: true,
      where: { _and: whereConditions },
      relationships: [
        {
          type: [{ type: 'CONTAINS' }],
          with: {
            type: ['CONTAINER'],
            select: true,
            relationships: [
              {
                type: [{ type: 'INSTANCE_OF' }],
                with: {
                  type: ['CONTAINER_IMAGE'],
                  select: true,
                },
              },
            ],
          },
        },
      ],
    };

    const allEntities: GraphSearchEntity[] = [];
    let hasNextPage = true;
    let after: string | null = null;
    let totalFetched = 0;
    const maxResults = 10000;
    const pageSize = 500;

    while (hasNextPage) {
      const variables: { query: typeof queryInput; projectId: string; first: number; after: string | null } = {
        query: queryInput,
        projectId,
        first: pageSize,
        after,
      };

      const response: GraphSearchData = await this.makeRequest<GraphSearchData>(
        GRAPH_SEARCH_QUERY,
        variables,
      );

      if (!response.graphSearch?.nodes) {
        throw new WizError(
          WizErrorType.API_ERROR,
          'Invalid graphSearch response format from Wiz API',
          500,
        );
      }

      for (const node of response.graphSearch.nodes) {
        allEntities.push(...node.entities);
      }

      totalFetched += response.graphSearch.nodes.length;
      hasNextPage = response.graphSearch.pageInfo.hasNextPage;
      after = response.graphSearch.pageInfo.endCursor;

      if (totalFetched >= maxResults) {
        throw new WizError(
          WizErrorType.API_ERROR,
          'Too many graph search results. Please refine your annotation filters.',
          400,
        );
      }
    }

    const entityIds = [...new Set(allEntities.map(e => e.id))];
    const containerImageIds = [
      ...new Set(
        allEntities
          .filter(e => e.type === 'CONTAINER_IMAGE')
          .map(e => e.id),
      ),
    ];

    return { entityIds, containerImageIds };
  }
}
