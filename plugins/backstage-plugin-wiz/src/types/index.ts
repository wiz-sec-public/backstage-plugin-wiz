export enum WizErrorType {
  MISSING_CONFIG = 'MISSING_CONFIG',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  API_ERROR = 'API_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

export interface WizErrorResponse {
  error: string;
  message: string;
  type: WizErrorType;
  details?: Record<string, unknown>;
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string;
}

export interface IssueNode {
  url: string;
  id: string;
  sourceRule: {
    id: string;
    name: string;
  };
  createdAt: string;
  type: string;
  status: string;
  severity: string;
  entitySnapshot: {
    id: string;
    name: string;
    type: string;
  };
}

export interface IssuesCounts {
  totalCount: number;
  criticalSeverityCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  informationalSeverityCount: number;
}

export interface IssuesResponse {
  issues: {
    totalCount: number;
    nodes: IssueNode[];
    pageInfo: PageInfo;
  };
}

export interface IssuesCountsResponse {
  issues: IssuesCounts;
}

export interface IssuesGroupedResponse {
  issuesGroupedByValue: {
    totalCount: number;
  };
}

export interface IssuesStatsResponse {
  severityCounts: IssuesCountsResponse;
  groupedCounts: IssuesGroupedResponse;
}

export interface VulnerabilityNode {
  id: string;
  vulnerabilityExternalId: string;
  portalUrl: string;
  name: string;
  CVSSSeverity: string;
  hasExploit: boolean;
  hasCisaKevExploit: boolean;
  status: string;
  vendorSeverity: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  fixedVersion?: string;
  vulnerableAsset: {
    id: string;
    type: string;
    name: string;
    providerUniqueId: string;
  };
  relatedIssueAnalytics: {
    issueCount: number;
    criticalSeverityCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    informationalSeverityCount: number;
  };
}

export interface VulnerabilitiesResponse {
  vulnerabilityFindings: {
    totalCount: number;
    nodes: VulnerabilityNode[];
    pageInfo: PageInfo;
  };
}

export interface CloudResourcesResponse {
  data: {
    cloudResources: {
      nodes: Array<{ id: string }>;
      pageInfo: PageInfo;
    };
  };
}

export interface VersionControlResourcesResponse {
  data: {
    versionControlResources: {
      nodes: Array<{ id: string }>;
      pageInfo: PageInfo;
    };
  };
}

export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

export type IssuesGraphQLResponse = GraphQLResponse<IssuesResponse>;
export type VulnerabilitiesGraphQLResponse =
  GraphQLResponse<VulnerabilitiesResponse>;
export type IssuesCountsGraphQLResponse = GraphQLResponse<IssuesCountsResponse>;
export type IssuesGroupedGraphQLResponse =
  GraphQLResponse<IssuesGroupedResponse>;
export type IssuesStatsGraphQLResponse = GraphQLResponse<IssuesStatsResponse>;
export type CloudResourcesGraphQLResponse =
  GraphQLResponse<CloudResourcesResponse>;
export type VersionControlResourcesGraphQLResponse =
  GraphQLResponse<VersionControlResourcesResponse>;

export interface IdsResult {
  ids: string[];
  error?: Error;
}

export interface GraphSearchResult {
  entityIds: string[];
  containerImageIds: string[];
}

export interface EntityIds {
  cloudResourceIds: string[];
  versionControlIds: string[];
  directAssetIds: string[];
  projectIds: string[];
  graphEntityIds: string[];
  graphContainerImageIds: string[];
}
