import { WizAPI } from './WizAPI';
import { DiscoveryApi, FetchApi, ConfigApi } from '@backstage/core-plugin-api';
import {
  WizErrorType,
  WizErrorResponse,
  IssuesResponse,
  VulnerabilitiesResponse,
  IssuesStatsResponse,
  CloudResourcesResponse,
  VersionControlResourcesResponse,
  GraphSearchResult,
} from '../types';

export class WizError extends Error {
  constructor(
    public type: WizErrorType,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WizError';
  }
}

export type Options = {
  discoveryApi: DiscoveryApi;
  fetchApi: FetchApi;
  configApi: ConfigApi;
};

export class WizClient implements WizAPI {
  readonly #discoveryApi: DiscoveryApi;
  readonly #fetchApi: FetchApi;

  constructor(options: Options) {
    this.#discoveryApi = options.discoveryApi;
    this.#fetchApi = options.fetchApi;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = (await response.json()) as WizErrorResponse;

      switch (errorData.type) {
        case WizErrorType.MISSING_CONFIG:
          throw new WizError(
            WizErrorType.MISSING_CONFIG,
            'Wiz plugin is not properly configured',
            errorData.details,
          );
        case WizErrorType.UNAUTHORIZED:
          throw new WizError(
            WizErrorType.UNAUTHORIZED,
            'Authentication failed with Wiz API',
            errorData.details,
          );
        case WizErrorType.FORBIDDEN:
          throw new WizError(
            WizErrorType.FORBIDDEN,
            'Insufficient permissions to access Wiz resources',
            errorData.details,
          );
        case WizErrorType.INVALID_REQUEST:
          throw new WizError(
            WizErrorType.INVALID_REQUEST,
            errorData.message || 'Invalid request parameters',
            errorData.details,
          );
        default:
          throw new WizError(
            WizErrorType.API_ERROR,
            errorData.message || 'Unknown error occurred',
            errorData.details,
          );
      }
    }

    const data = await response.json();
    return data as T;
  }

  private buildQueryParams(
    filters: Record<string, unknown>,
    after?: string,
  ): URLSearchParams {
    const query = new URLSearchParams();

    if (!filters) {
      if (after) {
        query.append('after', after);
      }
      return query;
    }

    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== undefined),
    );

    Object.entries(cleanFilters).forEach(([key, value]) => {
      if (!value) return;

      if (Array.isArray(value)) {
        value.filter(Boolean).forEach(v => {
          query.append(key, v.toString());
        });
      } else if (typeof value === 'object') {
        const cleanObject = JSON.stringify(
          this.cleanUndefinedValues(value as Record<string, unknown>),
        );
        query.append(key, cleanObject);
      } else {
        query.append(key, value.toString());
      }
    });

    if (after) {
      query.append('after', after);
    }

    return query;
  }

  private cleanUndefinedValues(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => {
          if (value === undefined) return false;
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === 'object' && value !== null) {
            const cleaned = this.cleanUndefinedValues(
              value as Record<string, unknown>,
            );
            return Object.keys(cleaned).length > 0;
          }
          return true;
        })
        .map(([key, value]) => {
          if (
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value)
          ) {
            return [
              key,
              this.cleanUndefinedValues(value as Record<string, unknown>),
            ];
          }
          return [key, value];
        }),
    );
  }

  async fetchIssues(
    filters: Record<string, unknown> = {},
    after?: string,
  ): Promise<IssuesResponse> {
    try {
      const baseUrl = await this.#discoveryApi.getBaseUrl(
        'backstage-plugin-wiz',
      );
      const queryParams = this.buildQueryParams(filters, after);

      const response = await this.#fetchApi.fetch(
        `${baseUrl}/wiz-issues?${queryParams.toString()}`,
      );
      const data = await this.handleResponse<IssuesResponse>(response);

      return data;
    } catch (error) {
      if (error instanceof WizError) {
        throw error;
      }
      throw new WizError(
        WizErrorType.API_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  }

  async fetchVulnerabilities(
    filters: Record<string, unknown> = {},
    after?: string,
  ): Promise<VulnerabilitiesResponse> {
    try {
      const baseUrl = await this.#discoveryApi.getBaseUrl(
        'backstage-plugin-wiz',
      );
      const queryParams = this.buildQueryParams(filters, after);
      const response = await this.#fetchApi.fetch(
        `${baseUrl}/wiz-vulnerabilities?${queryParams.toString()}`,
      );

      const data = await this.handleResponse<VulnerabilitiesResponse>(response);
      return data;
    } catch (error) {
      if (error instanceof WizError) {
        throw error;
      }
      throw new WizError(
        WizErrorType.API_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  }

  async fetchIssuesStats(
    filters: Record<string, unknown> = {},
  ): Promise<IssuesStatsResponse> {
    try {
      const baseUrl = await this.#discoveryApi.getBaseUrl(
        'backstage-plugin-wiz',
      );
      const queryParams = this.buildQueryParams(filters);

      const response = await this.#fetchApi.fetch(
        `${baseUrl}/wiz-issues-stats?${queryParams.toString()}`,
      );

      const data = await this.handleResponse<IssuesStatsResponse>(response);
      return data;
    } catch (error) {
      if (error instanceof WizError) {
        throw error;
      }
      throw new WizError(
        WizErrorType.API_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  }

  async fetchCloudResources(
    filters: Record<string, unknown> = {},
  ): Promise<CloudResourcesResponse> {
    try {
      const baseUrl = await this.#discoveryApi.getBaseUrl(
        'backstage-plugin-wiz',
      );
      const queryParams = this.buildQueryParams(filters);

      const response = await this.#fetchApi.fetch(
        `${baseUrl}/wiz-cloud-resources?${queryParams.toString()}`,
      );

      const data = await this.handleResponse<CloudResourcesResponse>(response);
      return data;
    } catch (error) {
      if (error instanceof WizError) {
        throw error;
      }
      throw new WizError(
        WizErrorType.API_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  }

  async fetchVersionControlResources(
    filters: Record<string, unknown> = {},
  ): Promise<VersionControlResourcesResponse> {
    try {
      const baseUrl = await this.#discoveryApi.getBaseUrl(
        'backstage-plugin-wiz',
      );
      const queryParams = this.buildQueryParams(filters);

      const response = await this.#fetchApi.fetch(
        `${baseUrl}/wiz-version-control?${queryParams.toString()}`,
      );

      const data =
        await this.handleResponse<VersionControlResourcesResponse>(response);
      return data;
    } catch (error) {
      if (error instanceof WizError) {
        throw error;
      }
      throw new WizError(
        WizErrorType.API_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  }

  async fetchGraphSearch(
    annotations: Array<{ key: string; value: string }>,
    projectId?: string,
  ): Promise<GraphSearchResult> {
    try {
      const baseUrl = await this.#discoveryApi.getBaseUrl(
        'backstage-plugin-wiz',
      );
      const query = new URLSearchParams();
      query.append('annotations', JSON.stringify(annotations));
      if (projectId) {
        query.append('projectId', projectId);
      }

      const response = await this.#fetchApi.fetch(
        `${baseUrl}/wiz-graph-search?${query.toString()}`,
      );

      const data = await this.handleResponse<GraphSearchResult>(response);
      return data;
    } catch (error) {
      if (error instanceof WizError) {
        throw error;
      }
      throw new WizError(
        WizErrorType.API_ERROR,
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  }
}
