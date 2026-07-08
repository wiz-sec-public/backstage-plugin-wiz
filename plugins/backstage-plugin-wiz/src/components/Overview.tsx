import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { EntityIds } from '../types';
import { IssuesView } from './issues/IssuesView';
import { VulnerabilitiesTable } from './vulnerabilities/VulnerabilitiesTable';
import {
  WizRateLimitProvider,
  useWizRateLimit,
} from './shared/WizRateLimitContext';
import { WizRateLimitState } from './shared/WizRateLimitState';

const StyledBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(4),
}));

interface OverviewProps {
  entityIds: EntityIds;
}

const OverviewContent = ({ entityIds }: OverviewProps) => {
  const { isRateLimited } = useWizRateLimit();

  // When the tenant is rate-limited, show a single consolidated state instead
  // of one error panel per widget. The widgets stay mounted (hidden) so they
  // keep their reported state — unmounting them would clear the report, flip
  // the flag, remount and re-fetch in a loop. See WZ-113816.
  return (
    <>
      {isRateLimited && <WizRateLimitState />}
      <StyledBox sx={{ display: isRateLimited ? 'none' : 'flex' }}>
        <IssuesView entityIds={entityIds} />
        <VulnerabilitiesTable entityIds={entityIds} />
      </StyledBox>
    </>
  );
};

/**
 * Resets the rate-limit provider when the user switches entities (this
 * component stays mounted across switches). `resetKey` is the Backstage entity
 * ref, which is unique and stable per catalog entity. Keying on the resolved
 * Wiz ids instead would let two distinct entities that share the same Wiz
 * annotations (e.g. the same `wiz.io/project`) collide and leak each other's
 * rate-limit state. See WZ-113816.
 */
export const Overview = ({
  entityIds,
  resetKey,
}: OverviewProps & { resetKey: string }) => (
  <WizRateLimitProvider resetKey={resetKey}>
    <OverviewContent entityIds={entityIds} />
  </WizRateLimitProvider>
);
