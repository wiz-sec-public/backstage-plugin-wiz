import { render, screen } from '@testing-library/react';

jest.mock('@backstage/core-components', () => ({
  ResponseErrorPanel: ({ error, title }: { error: Error; title?: string }) => (
    <div data-testid="response-error-panel">
      {title ? <div data-testid="title">{title}</div> : null}
      <div data-testid="message">{error.message}</div>
    </div>
  ),
  EmptyState: ({
    title,
    description,
  }: {
    title?: string;
    description?: string;
  }) => (
    <div data-testid="empty-state">
      {title ? <div data-testid="title">{title}</div> : null}
      {description ? <div data-testid="description">{description}</div> : null}
    </div>
  ),
}));
jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (cfg: { id: string }) => ({ id: cfg.id }),
}));

import { WizErrorState } from './WizErrorState';
import { WizError } from '../../api/WizClient';
import { WizErrorType } from '../../types';

describe('WizErrorState', () => {
  it('renders a distinct title for RATE_LIMITED errors', () => {
    render(
      <WizErrorState
        error={
          new WizError(WizErrorType.RATE_LIMITED, 'Wiz API rate limit exceeded')
        }
      />,
    );

    expect(screen.getByTestId('title').textContent).toMatch(
      /Wiz API rate limit reached/i,
    );
  });

  it('renders the unauthorized title for UNAUTHORIZED errors', () => {
    render(
      <WizErrorState
        error={new WizError(WizErrorType.UNAUTHORIZED, 'token expired')}
      />,
    );

    expect(screen.getByTestId('title').textContent).toMatch(
      /Authentication Failed/i,
    );
  });

  it('falls back to a generic panel for unknown error types', () => {
    render(<WizErrorState error={new Error('boom')} />);

    expect(screen.queryByTestId('title')).toBeNull();
    expect(screen.getByTestId('message').textContent).toBe('boom');
  });
});
