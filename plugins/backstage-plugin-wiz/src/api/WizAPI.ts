import { createApiRef } from '@backstage/core-plugin-api';
import {
  IssuesResponse,
  VulnerabilitiesResponse,
  IssuesStatsResponse,
  CloudResourcesResponse,
  VersionControlResourcesResponse,
  GraphSearchResult,
} from '../types';

export const wizApiRef = createApiRef<WizAPI>({
  id: 'plugin.wiz.service',
});

export interface WizAPI {
  fetchIssues: (
    filters?: Record<string, unknown>,
    after?: string,
  ) => Promise<IssuesResponse>;
  fetchVulnerabilities: (
    filters?: Record<string, unknown>,
    after?: string,
  ) => Promise<VulnerabilitiesResponse>;
  fetchIssuesStats: (
    filters?: Record<string, unknown>,
  ) => Promise<IssuesStatsResponse>;
  fetchCloudResources: (
    filters?: Record<string, unknown>,
  ) => Promise<CloudResourcesResponse>;
  fetchVersionControlResources: (
    filters?: Record<string, unknown>,
    after?: string,
  ) => Promise<VersionControlResourcesResponse>;
  fetchGraphSearch: (
    annotations: Array<{ key: string; value: string }>,
    projectId?: string,
  ) => Promise<GraphSearchResult>;
}
