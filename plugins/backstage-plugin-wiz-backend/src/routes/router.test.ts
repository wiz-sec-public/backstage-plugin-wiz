import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { createRouter } from '.';
import { WizClient } from '../services/WizClient';
import { IssuesResponse, VulnerabilityFindingsResponse } from '../types';
import express from 'express';
import request from 'supertest';

jest.mock('../services/WizClient');
jest.mock('../services/WizAuth');

function createTestLogger(): LoggerService {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: () => createTestLogger(),
  };
}

describe('createRouter', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const mockConfig: jest.Mocked<Config> = {
    getString: jest.fn(),
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
    getOptionalNumber: jest.fn(),
    getOptionalString: jest.fn(),
    getOptionalStringArray: jest.fn(),
    getStringArray: jest.fn(),
  };

  const logger = createTestLogger();

  beforeEach(async () => {
    mockConfig.getString.mockImplementation((key: string) => {
      switch (key) {
        case 'wiz.clientId':
          return 'test-client-id';
        case 'wiz.clientSecret':
          return 'test-client-secret';
        case 'wiz.authUrl':
          return 'https://test.auth.url';
        case 'wiz.apiEndpointUrl':
          return 'https://test.api.url';
        default:
          throw new Error(`Unexpected config key: ${key}`);
      }
    });

    const router = await createRouter({
      logger,
      config: mockConfig,
    });

    app = express().use(router);
  });

  describe('/wiz-issues', () => {
    it('returns issues successfully', async () => {
      const mockResponse: IssuesResponse = {
        data: {
          issues: {
            totalCount: 1,
            nodes: [
              {
                id: '1',
                url: 'http://example.com',
                sourceRule: {
                  id: 'rule-1',
                  name: 'Test Rule',
                  __typename: 'Control',
                },
                createdAt: '2024-01-01T00:00:00Z',
                type: 'SECURITY',
                status: 'OPEN',
                severity: 'HIGH',
                entitySnapshot: {
                  id: 'snap-1',
                  type: 'AWS',
                  name: 'test-entity',
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: '',
            },
          },
        },
      };

      jest
        .spyOn(WizClient.prototype, 'getIssues')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .get('/wiz-issues')
        .query({ project: 'test-project' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it('forwards a column sort to the Wiz client', async () => {
      const getIssues = jest
        .spyOn(WizClient.prototype, 'getIssues')
        .mockResolvedValueOnce({ data: { issues: { nodes: [] } } } as never);

      const response = await request(app).get('/wiz-issues').query({
        project: 'test-project',
        orderByField: 'CREATED_AT',
        orderByDirection: 'ASC',
      });

      expect(response.status).toBe(200);
      expect(getIssues).toHaveBeenCalledWith(
        { project: 'test-project' },
        null,
        {
          field: 'CREATED_AT',
          direction: 'ASC',
        },
      );
    });

    it('rejects an order field the issues query cannot sort by', async () => {
      const getIssues = jest.spyOn(WizClient.prototype, 'getIssues');

      const response = await request(app)
        .get('/wiz-issues')
        .query({ orderByField: 'RESOURCE_NAME', orderByDirection: 'ASC' });

      expect(response.status).toBe(400);
      expect(getIssues).not.toHaveBeenCalled();
    });
  });

  describe('/wiz-vulnerabilities', () => {
    it('returns vulnerabilities successfully', async () => {
      const mockResponse: VulnerabilityFindingsResponse = {
        data: {
          vulnerabilityFindings: {
            totalCount: 1,
            nodes: [
              {
                id: '1',
                name: 'CVE-2024-1234',
                portalUrl: 'http://example.com',
                CVSSSeverity: 'HIGH',
                hasExploit: false,
                hasCisaKevExploit: false,
                relatedIssueAnalytics: {
                  issueCount: 1,
                  criticalSeverityCount: 0,
                  highSeverityCount: 1,
                  mediumSeverityCount: 0,
                  lowSeverityCount: 0,
                  informationalSeverityCount: 0,
                },
                status: 'OPEN',
                vendorSeverity: 'HIGH',
                firstDetectedAt: '2024-01-01T00:00:00Z',
                lastDetectedAt: '2024-01-01T00:00:00Z',
                fixedVersion: '2.0.0',
                vulnerableAsset: {
                  id: 'asset-1',
                  type: 'CONTAINER',
                  name: 'test-container',
                  providerUniqueId: 'test-id',
                },
              },
            ],
            pageInfo: {
              hasNextPage: false,
              endCursor: '',
            },
          },
        },
      };

      jest
        .spyOn(WizClient.prototype, 'getVulnerabilityFindings')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .get('/wiz-vulnerabilities')
        .query({ projectId: 'test-project' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it('forwards a column sort to the Wiz client', async () => {
      const getVulnerabilityFindings = jest
        .spyOn(WizClient.prototype, 'getVulnerabilityFindings')
        .mockResolvedValueOnce({
          data: { vulnerabilityFindings: { nodes: [] } },
        } as never);

      const response = await request(app).get('/wiz-vulnerabilities').query({
        projectId: 'test-project',
        orderByField: 'FIRST_DETECTED_AT',
        orderByDirection: 'DESC',
      });

      expect(response.status).toBe(200);
      expect(getVulnerabilityFindings).toHaveBeenCalledWith(
        { projectId: 'test-project' },
        null,
        { field: 'FIRST_DETECTED_AT', direction: 'DESC' },
      );
    });
  });

  describe('/wiz-issues-stats', () => {
    it('returns issues statistics successfully', async () => {
      const mockSeverityCounts = {
        data: {
          issues: {
            totalCount: 10,
            criticalSeverityCount: 2,
            highSeverityCount: 3,
            mediumSeverityCount: 3,
            lowSeverityCount: 2,
            informationalSeverityCount: 0,
          },
        },
      };

      const mockGroupedCounts = {
        data: {
          issuesGroupedByValue: {
            totalCount: 10,
          },
        },
      };

      jest
        .spyOn(WizClient.prototype, 'getIssuesSeverityCounts')
        .mockResolvedValueOnce(mockSeverityCounts);
      jest
        .spyOn(WizClient.prototype, 'getIssuesGroupedCount')
        .mockResolvedValueOnce(mockGroupedCounts);

      const response = await request(app)
        .get('/wiz-issues-stats')
        .query({ project: 'test-project' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        severityCounts: mockSeverityCounts,
        groupedCounts: mockGroupedCounts,
      });
    });
  });

  describe('/wiz-cloud-resources', () => {
    it('returns cloud resources successfully', async () => {
      const mockResponse = {
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

      jest
        .spyOn(WizClient.prototype, 'getAllCloudResources')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .get('/wiz-cloud-resources')
        .query({ providerUniqueId: '["test-id"]' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it('handles invalid providerUniqueId format', async () => {
      const response = await request(app)
        .get('/wiz-cloud-resources')
        .query({ providerUniqueId: { test: '' } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid Request');
    });
  });

  describe('/wiz-version-control', () => {
    it('returns version control resources successfully', async () => {
      const mockResponse = {
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

      jest
        .spyOn(WizClient.prototype, 'getVersionControlResources')
        .mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .get('/wiz-version-control')
        .query({ search: 'test' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });
  });
});
