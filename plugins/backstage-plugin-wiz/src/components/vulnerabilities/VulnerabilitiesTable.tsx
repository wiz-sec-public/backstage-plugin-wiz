import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import OpenInNewIconImport from '@mui/icons-material/OpenInNew';
// Some downstream Backstage builds wrap the default export as `{ default: Icon }`
// due to CJS/ESM interop differences, which then fails React's element-type check
// with "Element type is invalid... got: object". Unwrap defensively. See WZ-83111.
const OpenInNewIcon =
  (OpenInNewIconImport as unknown as { default?: typeof OpenInNewIconImport })
    ?.default ?? OpenInNewIconImport;
import {
  Box,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
  Paper,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { wizApiRef, WizError } from '../../api';
import { EntityIds, VulnerabilityNode, WizErrorType } from '../../types';
import { FormattedDateTime } from '../shared/FormattedDateTime';
import { SeverityChip } from '../shared/SeverityChip';
import { SeverityIndicator } from '../shared/SeverityIndicator';
import { WizErrorState } from '../shared/WizErrorState';
import {
  isRateLimitError,
  useRateLimitReporter,
} from '../shared/WizRateLimitContext';
import { buildFilterBy, Filters } from './filters';

interface VulnerabilitiesState {
  vulnerabilities: VulnerabilityNode[];
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

interface VulnerabilitiesTableProps {
  entityIds: EntityIds;
}

export const VulnerabilitiesTable = ({
  entityIds,
}: VulnerabilitiesTableProps) => {
  const api = useApi(wizApiRef);

  const [state, setState] = useState<VulnerabilitiesState>({
    vulnerabilities: [],
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
  const report = useRateLimitReporter('vulnerabilities');

  // Guards against stale async responses: each fetch takes the next id, and a
  // response is applied only if it is still the latest. Without this, a late
  // response from a previous entity (or filter/page) could set widget state or
  // report a wrong rate-limit result for the entity now on screen. See WZ-113816.
  const requestId = useRef(0);

  const fetchVulnerabilities = useCallback(
    async (cursor?: string) => {
      const id = ++requestId.current;
      const isStale = () => id !== requestId.current;
      setState(prev => ({ ...prev, loading: true }));
      try {
        const result = await api.fetchVulnerabilities(filters, cursor);
        if (isStale()) return;
        setState(prev => ({
          ...prev,
          vulnerabilities: cursor
            ? [...prev.vulnerabilities, ...result.vulnerabilityFindings.nodes]
            : result.vulnerabilityFindings.nodes,
          totalFetched: cursor
            ? prev.totalFetched + result.vulnerabilityFindings.nodes.length
            : result.vulnerabilityFindings.nodes.length,
          totalCount:
            result.vulnerabilityFindings.totalCount === 0 &&
            (result.vulnerabilityFindings.nodes.length > 0 ||
              result.vulnerabilityFindings.pageInfo.hasNextPage)
              ? prev.totalCount
              : result.vulnerabilityFindings.totalCount,
          hasNextPage: result.vulnerabilityFindings.pageInfo.hasNextPage,
          after: result.vulnerabilityFindings.pageInfo.endCursor,
          error: null,
        }));
        report(null);
      } catch (err) {
        if (isStale()) return;
        const wizError =
          err instanceof WizError
            ? err
            : new WizError(
                WizErrorType.API_ERROR,
                'Failed to fetch vulnerabilities',
              );
        setState(prev => ({ ...prev, error: wizError }));
        report(wizError);
      } finally {
        if (!isStale()) setState(prev => ({ ...prev, loading: false }));
      }
    },
    [filters, api, report],
  );

  useEffect(() => {
    const updatedFilters = buildFilterBy(entityIds);
    setFilters(updatedFilters);
  }, [entityIds]);

  useEffect(() => {
    if (!filters || Object.keys(filters).length === 0) return;
    setState(prev => ({ ...prev, vulnerabilities: [], currentPage: 0 }));
    fetchVulnerabilities(undefined);
  }, [filters, fetchVulnerabilities]);

  const handlePageChange = async (_: unknown, newPage: number) => {
    const requiredItems = (newPage + 1) * state.pageSize;

    if (requiredItems > state.vulnerabilities.length && state.hasNextPage) {
      await fetchVulnerabilities(state.after);
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

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const updatedFilters = buildFilterBy(entityIds, state.searchText);
    setFilters(updatedFilters);
  };

  const getPageData = () => {
    const start = state.currentPage * state.pageSize;
    const end = Math.min(start + state.pageSize, state.vulnerabilities.length);
    return state.vulnerabilities.slice(start, end);
  };

  if (error) {
    return <div>Error loading filters: {error.message}</div>;
  }

  if (state.loading && state.vulnerabilities.length === 0) {
    return <Progress />;
  }

  if (state.error) {
    // Rate-limit is surfaced once at the tab level; suppress this widget's panel.
    return isRateLimitError(state.error) ? null : (
      <WizErrorState error={state.error} />
    );
  }

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h5">Vulnerabilities</Typography>
        <Box component="form" onSubmit={handleSearchSubmit} sx={{ width: 300 }}>
          <TextField
            fullWidth
            size="small"
            variant="outlined"
            placeholder="Search CVE IDs (comma-separated)"
            value={state.searchText}
            onChange={handleSearchChange}
          />
        </Box>
      </Box>

      {state.vulnerabilities.length > 0 ? (
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer>
            <Table stickyHeader aria-label="vulnerabilities table">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Finding</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Resource</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Severity</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Related Issues</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Exploits</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>First Detected</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Last Detected</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getPageData().map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.vulnerableAsset.name}</TableCell>
                    <TableCell>
                      <SeverityChip severity={row.CVSSSeverity} />
                    </TableCell>
                    <TableCell>
                      <SeverityIndicator
                        data={row.relatedIssueAnalytics}
                        inline
                      />
                    </TableCell>
                    <TableCell>
                      <Box display="flex">
                        {row.hasExploit && (
                          <Box mr={1}>
                            <Chip
                              label="Known Exploit"
                              size="small"
                              color="secondary"
                            />
                          </Box>
                        )}
                        {row.hasCisaKevExploit && (
                          <Chip label="CISA KEV" size="small" color="primary" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {row.firstDetectedAt && (
                        <FormattedDateTime dateString={row.firstDetectedAt} />
                      )}
                    </TableCell>
                    <TableCell>
                      {row.lastDetectedAt && (
                        <FormattedDateTime dateString={row.lastDetectedAt} />
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Open in Wiz">
                        <IconButton
                          onClick={() => window.open(row.portalUrl, '_blank')}
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
            No Vulnerabilities Found
          </Typography>
          <Typography
            variant="body2"
            color="textSecondary"
            marginTop={1}
            component="p"
          >
            No vulnerabilities were found for the current set of annotations.
            This could mean either there are no vulnerabilities, or the
            annotations need to be updated.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
