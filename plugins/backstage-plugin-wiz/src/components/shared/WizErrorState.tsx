import { ResponseErrorPanel } from '@backstage/core-components';
import { WizError } from '../../api';
import { WizErrorType } from '../../types';
import { WizRateLimitState } from './WizRateLimitState';

interface WizErrorStateProps {
  error: Error | WizError;
}

export const WizErrorState = ({ error }: WizErrorStateProps) => {
  if (!(error instanceof WizError)) {
    return <ResponseErrorPanel error={error} />;
  }

  switch (error.type) {
    case WizErrorType.MISSING_CONFIG:
      return (
        <ResponseErrorPanel
          error={error}
          title="Missing Configuration - Please configure the Wiz plugin in your app-config.yaml"
        />
      );
    case WizErrorType.UNAUTHORIZED:
      return (
        <ResponseErrorPanel
          error={error}
          title="Authentication Failed - Unable to authenticate with Wiz API"
        />
      );
    case WizErrorType.RATE_LIMITED:
      return <WizRateLimitState />;
    default:
      return <ResponseErrorPanel error={error} />;
  }
};
