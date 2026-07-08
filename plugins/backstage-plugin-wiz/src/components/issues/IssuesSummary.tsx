import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { wizApiRef, WizError } from '../../api';
import { EntityIds, IssuesStatsResponse, WizErrorType } from '../../types';
import { SeverityIndicator } from '../shared/SeverityIndicator';
import { WizErrorState } from '../shared/WizErrorState';
import {
  isRateLimitError,
  useRateLimitReporter,
} from '../shared/WizRateLimitContext';
import { buildFilterBy, Filters } from './filters';

const PREFIX = 'IssuesSummary';

const classes = {
  card: `${PREFIX}-card`,
  contentContainer: `${PREFIX}-contentContainer`,
  section: `${PREFIX}-section`,
  sectionTitle: `${PREFIX}-sectionTitle`,
  resourceCount: `${PREFIX}-resourceCount`,
  severitySection: `${PREFIX}-severitySection`,
};

const StyledCard = styled(Card)(({ theme }) => ({
  [`&.${classes.card}`]: {
    backgroundColor: theme.palette.background.default,
  },

  [`& .${classes.contentContainer}`]: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(4),
  },

  [`& .${classes.section}`]: {
    display: 'flex',
    flexDirection: 'column',
  },

  [`& .${classes.sectionTitle}`]: {
    color: theme.palette.text.secondary,
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(0.5),
  },

  [`& .${classes.resourceCount}`]: {
    fontSize: '16px',
    fontWeight: 500,
  },

  [`& .${classes.severitySection}`]: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
}));

interface SummaryState {
  stats: IssuesStatsResponse | undefined;
  loading: boolean;
  error: Error | WizError | null;
}

interface IssuesSummaryProps {
  entityIds: EntityIds;
}

export const IssuesSummary = ({ entityIds }: IssuesSummaryProps) => {
  const api = useApi(wizApiRef);

  const [state, setState] = useState<SummaryState>({
    stats: undefined,
    loading: true,
    error: null,
  });

  const [filters, setFilters] = useState<Filters>({});
  const report = useRateLimitReporter('issues-summary');

  // Guards against stale async responses: each fetch takes the next id, and a
  // response is applied only if it is still the latest. Without this, a late
  // response from a previous entity could set widget state or report a wrong
  // rate-limit result for the entity now on screen. See WZ-113816.
  const requestId = useRef(0);

  useEffect(() => {
    if (!entityIds) return; // Skip if entityIds not ready

    const updatedFilters = buildFilterBy(entityIds);
    setFilters(updatedFilters);
  }, [entityIds]);

  useEffect(() => {
    const fetchStats = async () => {
      const id = ++requestId.current;
      const isStale = () => id !== requestId.current;
      setState(prev => ({ ...prev, loading: true }));
      try {
        const result = await api.fetchIssuesStats(filters);
        if (isStale()) return;
        setState(prev => ({
          ...prev,
          stats: result,
          error: null,
        }));
        report(null);
      } catch (err) {
        if (isStale()) return;
        const apiError =
          err instanceof WizError
            ? err
            : new WizError(WizErrorType.API_ERROR, 'Failed to fetch stats');
        setState(prev => ({ ...prev, error: apiError }));
        report(apiError);
      } finally {
        if (!isStale()) setState(prev => ({ ...prev, loading: false }));
      }
    };

    if (Object.keys(filters).length > 0) {
      fetchStats();
    }
  }, [filters, api, report]);

  if (state.loading) {
    return <Progress />;
  }

  if (state.error) {
    // Rate-limit is surfaced once at the tab level; suppress this widget's panel.
    return isRateLimitError(state.error) ? null : (
      <WizErrorState error={state.error} />
    );
  }

  return (
    <StyledCard className={classes.card}>
      <CardContent>
        <Box className={classes.contentContainer}>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              RESOURCES WITH ISSUES
            </Typography>
            <Typography className={classes.resourceCount}>
              {state.stats?.groupedCounts?.issuesGroupedByValue?.totalCount ||
                0}{' '}
              Resources
            </Typography>
          </Box>
          <Box className={classes.section}>
            <Typography className={classes.sectionTitle}>
              ISSUES BY SEVERITY
            </Typography>
            <Box className={classes.severitySection}>
              {state.stats?.severityCounts?.issues && (
                <SeverityIndicator
                  data={state.stats.severityCounts.issues}
                  inline
                />
              )}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </StyledCard>
  );
};
