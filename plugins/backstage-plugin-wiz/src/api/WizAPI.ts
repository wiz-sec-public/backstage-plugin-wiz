import { createApiRef } from '@backstage/core-plugin-api';
import {
  IssuesResponse,
  VulnerabilitiesResponse,
  IssuesStatsResponse,
  CloudResourcesResponse,
  VersionControlResourcesResponse,
} from '../types';

export const wizApiRef = createApiRef<WizAPI>({
  id: 'plugin.wiz.service',
});

export interface WizOrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface WizAPI {
  fetchIssues: (
    filters?: Record<string, unknown>,
    after?: string,
    orderBy?: WizOrderBy,
  ) => Promise<IssuesResponse>;
  fetchVulnerabilities: (
    filters?: Record<string, unknown>,
    after?: string,
    orderBy?: WizOrderBy,
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
}
