import React from 'react';
import { Box, Typography } from '@mui/material';
import { makeStyles } from '@mui/styles';

const useSeverityStyles = makeStyles(() => ({
  severityContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  severityChip: {
    borderRadius: '50%',
    height: '24px',
    width: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '12px',
    marginRight: '4px',
  },
  severityCount: {
    fontSize: '15px',
    fontWeight: 500,
  },
  severitySection: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  critical: {
    backgroundColor: 'hsl(360deg 100% 96.8%)',
    color: 'hsl(358deg 65% 47%)',
    border: '1px solid hsl(359deg 74.2% 81.7%)',
  },
  high: {
    backgroundColor: 'hsl(34deg 100% 91.7%)',
    color: 'hsl(16deg 45% 41.5%)',
    border: '1px solid hsl(21deg 100% 74.5%)',
  },
  medium: {
    backgroundColor: 'hsl(53deg 100% 88.9%)',
    color: 'hsl(42deg 50% 31%)',
    border: '1px solid hsl(48deg 59.6% 64.3%)',
  },
  low: {
    backgroundColor: 'hsl(239deg 13.4% 95.4%)',
    color: 'hsl(220deg 6% 40%)',
    border: '1px solid hsl(234deg 10.4% 84.4%)',
  },
  info: {
    backgroundColor: 'hsl(220deg 13.4% 97%)',
    color: 'hsl(220deg 6% 60%)',
    border: '1px solid hsl(220deg 10.4% 89%)',
  },
}));

type StyleKey = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface SeverityData {
  criticalSeverityCount?: number;
  highSeverityCount?: number;
  mediumSeverityCount?: number;
  lowSeverityCount?: number;
  informationalSeverityCount?: number;
}

interface SeverityConfig {
  key: keyof SeverityData;
  label: string;
  styleKey: StyleKey;
}

const severityConfig: readonly SeverityConfig[] = [
  {
    key: 'criticalSeverityCount',
    label: 'C',
    styleKey: 'critical',
  },
  {
    key: 'highSeverityCount',
    label: 'H',
    styleKey: 'high',
  },
  {
    key: 'mediumSeverityCount',
    label: 'M',
    styleKey: 'medium',
  },
  {
    key: 'lowSeverityCount',
    label: 'L',
    styleKey: 'low',
  },
  {
    key: 'informationalSeverityCount',
    label: 'I',
    styleKey: 'info',
  },
];

interface SeverityIndicatorProps {
  data: SeverityData;
  inline?: boolean;
}

export const SeverityIndicator: React.FC<SeverityIndicatorProps> = ({
  data,
  inline = false,
}) => {
  const classes = useSeverityStyles();

  return (
    <Box
      className={inline ? classes.severitySection : classes.severityContainer}
    >
      {severityConfig.map(({ key, label, styleKey }) => {
        const count = data[key] ?? 0;

        if (count > 0) {
          return (
            <Box key={key} className={classes.severityContainer}>
              <div className={`${classes.severityChip} ${classes[styleKey]}`}>
                {label}
              </div>
              <Typography className={classes.severityCount}>{count}</Typography>
            </Box>
          );
        }

        return null;
      })}
    </Box>
  );
};
