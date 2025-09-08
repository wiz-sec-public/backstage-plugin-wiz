
export const wizApi = {
  async fetchIssues() {
    return {
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
  },
  async fetchVulnerabilities() {
    return {
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
  },
  async fetchIssuesStats() {
    return {
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
  },
  async fetchCloudResources() {
    return {
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
  },
  async fetchVersionControlResources() {
    return {
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
  },
}
