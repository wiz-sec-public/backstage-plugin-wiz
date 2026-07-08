import { EmptyState } from '@backstage/core-components';

/**
 * Single, consolidated state shown when the Wiz API is rate-limiting the
 * tenant. Rendered once at the entity-tab level instead of one error panel
 * per data widget. See WZ-113816.
 */
export const WizRateLimitState = () => (
  <EmptyState
    missing="info"
    title="Wiz API rate limit reached"
    description="Data will be available again shortly. The plugin is retrying automatically — please refresh in a moment."
  />
);
