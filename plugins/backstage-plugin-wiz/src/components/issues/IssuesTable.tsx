import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { wizApiRef, WizError } from '../../api';
import { EntityIds, IssueNode, WizErrorType } from '../../types';
import { FormattedDateTime } from '../shared/FormattedDateTime';
import { SeverityChip } from '../shared/SeverityChip';
import { StatusChip } from '../shared/StatusChip';
import { WizErrorState } from '../shared/WizErrorState';
import { buildFilterBy, Filters } from './filters';

interface IssuesState {
  issues: IssueNode[];
  loading: boolean;
  error: Error | WizError | null;
  currentPage: number;
  pageSize: number;
  after?: string;
  hasNextPage: boolean;
  totalFetched: number;
  totalCount: number;
  searchText: string;
}

interface IssuesProps {
  entityIds: EntityIds;
}

export const Issues = ({ entityIds }: IssuesProps) => {
  const api = useApi(wizApiRef);

  const [state, setState] = useState<IssuesState>({
    issues: [],
    loading: true,
    error: null,
    currentPage: 0,
    pageSize: 10,
    hasNextPage: false,
    totalFetched: 0,
    totalCount: 0,
    searchText: '',
  });

  const [filters, setFilters] = useState<Filters>({});
  const [error] = useState<Error>();

  const fetchIssues = useCallback(
    async (cursor?: string) => {
      setState(prev => ({ ...prev, loading: true }));
      try {
        const result = await api.fetchIssues(filters, cursor);
        setState(prev => ({
          ...prev,
          issues: cursor
            ? [...prev.issues, ...result.issues.nodes]
            : result.issues.nodes,
          totalFetched: cursor
            ? prev.totalFetched + result.issues.nodes.length
            : result.issues.nodes.length,
          totalCount: result.issues.totalCount,
          hasNextPage: result.issues.pageInfo.hasNextPage,
          after: result.issues.pageInfo.endCursor,
          error: null,
        }));
      } catch (err) {
        const apiError =
          err instanceof WizError
            ? err
            : new WizError(WizErrorType.API_ERROR, 'Failed to fetch issues');
        setState(prev => ({ ...prev, error: apiError }));
      } finally {
        setState(prev => ({ ...prev, loading: false }));
      }
    },
    [filters, api],
  );

  useEffect(() => {
    const updatedFilters = buildFilterBy(entityIds);
    setFilters(updatedFilters);
  }, [entityIds]);

  useEffect(() => {
    if (!filters || Object.keys(filters).length === 0) return;
    setState(prev => ({ ...prev, issues: [], currentPage: 0 }));
    fetchIssues(undefined);
  }, [filters, fetchIssues]);

  const handlePageChange = async (_: unknown, newPage: number) => {
    const requiredItems = (newPage + 1) * state.pageSize;

    if (requiredItems > state.issues.length && state.hasNextPage) {
      await fetchIssues(state.after);
    }

    setState(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setState(prev => ({
      ...prev,
      pageSize: parseInt(event.target.value, 10),
      currentPage: 0,
    }));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState(prev => ({ ...prev, searchText: event.target.value }));
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      const updatedFilters = buildFilterBy(entityIds, state.searchText);
      setFilters(updatedFilters);
    }
  };

  if (error) {
    return <div>Error loading filters: {error.message}</div>;
  }

  if (state.loading && state.issues.length === 0) {
    return <Progress />;
  }

  if (state.error) {
    return <WizErrorState error={state.error} />;
  }

  const getPageData = () => {
    const start = state.currentPage * state.pageSize;
    const end = Math.min(start + state.pageSize, state.issues.length);
    return state.issues.slice(start, end);
  };

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h5">Issues</Typography>
        <input
          type="text"
          placeholder="Search Rule or Resource"
          value={state.searchText}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          style={{
            width: '300px',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ccc',
          }}
        />
      </Box>

      {state.issues.length > 0 ? (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader aria-label="issues table">
              <TableHead>
                <TableRow>
                  <TableCell>Issue</TableCell>
                  <TableCell>Resource</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getPageData().map(row => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Typography variant="subtitle1" component="span">
                        {row.sourceRule?.name || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="subtitle1" component="span">
                        {row.entitySnapshot.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <SeverityChip severity={row.severity} />
                    </TableCell>
                    <TableCell>
                      <StatusChip status={row.status} />
                    </TableCell>
                    <TableCell>
                      {row.createdAt && (
                        <FormattedDateTime dateString={row.createdAt} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Open in Wiz">
                        <IconButton
                          href={row.url}
                          target="_blank"
                          size="small"
                          aria-label="open in wiz"
                        >
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 20]}
            component="div"
            count={state.totalCount}
            rowsPerPage={state.pageSize}
            page={state.currentPage}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </Paper>
      ) : (
        <Box>
          <Typography variant="h6" color="textSecondary">
            No Issues Found
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            marginTop={1}
            component="p"
          >
            No issues were found for the current set of annotations. This could
            mean either there are no issues, or the annotations need to be
            updated.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
