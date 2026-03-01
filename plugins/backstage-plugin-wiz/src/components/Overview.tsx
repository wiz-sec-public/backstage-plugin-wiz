import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { EntityIds } from '../types';
import { IssuesView } from './issues/IssuesView';
import { VulnerabilitiesTable } from './vulnerabilities/VulnerabilitiesTable';

const StyledBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(4),
}));

interface OverviewProps {
  entityIds: EntityIds;
}

export const Overview = ({ entityIds }: OverviewProps) => {
  return (
    <StyledBox>
      <IssuesView entityIds={entityIds} />
      <VulnerabilitiesTable entityIds={entityIds} />
    </StyledBox>
  );
};
