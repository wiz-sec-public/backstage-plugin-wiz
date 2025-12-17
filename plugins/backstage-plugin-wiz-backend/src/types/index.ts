export enum WizErrorType {
  MISSING_CONFIG = 'MISSING_CONFIG',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  API_ERROR = 'API_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
}

export enum GraphQLErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  INTERNAL = 'INTERNAL',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  FORBIDDEN_IP = 'FORBIDDEN_IP',
  NOT_FOUND = 'NOT_FOUND',
}

export const ErrorHttpStatusMap: Record<GraphQLErrorCode, number> = {
  [GraphQLErrorCode.UNAUTHENTICATED]: 401,
  [GraphQLErrorCode.UNAUTHORIZED]: 403,
  [GraphQLErrorCode.BAD_USER_INPUT]: 400,
  [GraphQLErrorCode.INTERNAL]: 500,
  [GraphQLErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [GraphQLErrorCode.FORBIDDEN_IP]: 403,
  [GraphQLErrorCode.NOT_FOUND]: 404,
};

export const ErrorTypeMap: Record<GraphQLErrorCode, WizErrorType> = {
  [GraphQLErrorCode.UNAUTHENTICATED]: WizErrorType.UNAUTHORIZED,
  [GraphQLErrorCode.UNAUTHORIZED]: WizErrorType.UNAUTHORIZED,
  [GraphQLErrorCode.BAD_USER_INPUT]: WizErrorType.API_ERROR,
  [GraphQLErrorCode.INTERNAL]: WizErrorType.API_ERROR,
  [GraphQLErrorCode.RATE_LIMIT_EXCEEDED]: WizErrorType.API_ERROR,
  [GraphQLErrorCode.FORBIDDEN_IP]: WizErrorType.UNAUTHORIZED,
  [GraphQLErrorCode.NOT_FOUND]: WizErrorType.API_ERROR,
};

export interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface WizAuthError {
  error: string;
  error_description?: string;
  status?: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  type: WizErrorType;
  details?: unknown;
}

export class WizError extends Error {
  constructor(
    public type: WizErrorType,
    message: string,
    public statusCode: number = 500,
    public error?: Error | unknown,
  ) {
    super(message);
    this.name = 'WizError';
  }
}

export interface GraphQLError {
  message: string;
  extensions?: {
    code?: string;
  };
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface IssuesData {
  issues: {
    totalCount: number;
    nodes: Array<{
      url: string;
      id: string;
      sourceRule: {
        id: string;
        name: string;
        __typename: string;
      };
      createdAt: string;
      type: string;
      status: string;
      severity: string;
      entitySnapshot: {
        id: string;
        type: string;
        name: string;
      };
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface VulnerabilityFindingsData {
  vulnerabilityFindings: {
    totalCount: number;
    nodes: Array<{
      id: string;
      portalUrl: string;
      name: string;
      CVSSSeverity: string;
      hasExploit: boolean;
      hasCisaKevExploit: boolean;
      relatedIssueAnalytics: {
        issueCount: number;
        criticalSeverityCount: number;
        highSeverityCount: number;
        mediumSeverityCount: number;
        lowSeverityCount: number;
        informationalSeverityCount: number;
      };
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
    }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface IssuesCountsData {
  issues: {
    totalCount: number;
    criticalSeverityCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
    informationalSeverityCount: number;
  };
}

export interface IssuesGroupedData {
  issuesGroupedByValue: {
    totalCount: number;
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor: string;
}

export interface PaginatedResourceResponse<T> {
  nodes: Array<T>;
  pageInfo: PageInfo;
}

export interface ResourceData<T> {
  [key: string]: PaginatedResourceResponse<T>;
}

export interface CloudResourcesData extends ResourceData<{ id: string }> {
  cloudResources: {
    nodes: Array<{ id: string }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export interface VersionControlResourcesData extends ResourceData<{
  id: string;
}> {
  versionControlResources: {
    nodes: Array<{ id: string }>;
    pageInfo: {
      hasNextPage: boolean;
      endCursor: string;
    };
  };
}

export type IssuesResponse = GraphQLResponse<IssuesData>;
export type VulnerabilityFindingsResponse =
  GraphQLResponse<VulnerabilityFindingsData>;
export type IssuesCountsResponse = GraphQLResponse<IssuesCountsData>;
export type IssuesGroupedResponse = GraphQLResponse<IssuesGroupedData>;
export type CloudResourcesResponse = GraphQLResponse<CloudResourcesData>;
export type VersionControlResourcesResponse =
  GraphQLResponse<VersionControlResourcesData>;
