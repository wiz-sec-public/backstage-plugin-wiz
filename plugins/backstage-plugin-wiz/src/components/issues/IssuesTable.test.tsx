import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Issues } from './IssuesTable';
import { WizRateLimitProvider } from '../shared/WizRateLimitContext';

const mockFetchIssues = jest.fn();
const mockApi = { fetchIssues: mockFetchIssues };

jest.mock('@backstage/core-components', () => ({
  Progress: () => <div>loading</div>,
}));

jest.mock('@backstage/core-plugin-api', () => ({
  useApi: () => mockApi,
  createApiRef: (config: { id: string }) => ({ id: config.id }),
}));

const issue = {
  id: '1',
  url: 'https://wiz.example/issue/1',
  sourceRule: { id: 'rule-1', name: 'Public bucket' },
  createdAt: '2024-01-01T00:00:00Z',
  type: 'CLOUD_CONFIGURATION',
  status: 'OPEN',
  severity: 'HIGH',
  entitySnapshot: { id: 'snap-1', name: 'payments', type: 'BUCKET' },
};

const entityIds = {
  projectIds: ['proj-1'],
  cloudResourceIds: [],
  versionControlIds: [],
  directAssetIds: [],
};

describe('Issues table sorting', () => {
  it('requests a new Wiz order when a column header is clicked', async () => {
    mockFetchIssues.mockResolvedValue({
      issues: {
        nodes: [issue],
        pageInfo: { hasNextPage: false, endCursor: '' },
        totalCount: 1,
      },
    });

    render(
      <ThemeProvider theme={createTheme()}>
        <WizRateLimitProvider>
          <Issues entityIds={entityIds} />
        </WizRateLimitProvider>
      </ThemeProvider>,
    );

    await screen.findByRole('button', { name: 'Created At' });
    expect(mockFetchIssues).toHaveBeenCalledWith(
      { project: ['proj-1'] },
      undefined,
      { field: 'SEVERITY', direction: 'DESC' },
    );

    await userEvent.click(screen.getByRole('button', { name: 'Created At' }));

    await waitFor(() => {
      expect(mockFetchIssues).toHaveBeenCalledWith(
        { project: ['proj-1'] },
        undefined,
        { field: 'CREATED_AT', direction: 'DESC' },
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Created At' }));

    await waitFor(() => {
      expect(mockFetchIssues).toHaveBeenCalledWith(
        { project: ['proj-1'] },
        undefined,
        { field: 'CREATED_AT', direction: 'ASC' },
      );
    });
  });
});
