import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';

jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (cfg: { id: string }) => ({ id: cfg.id }),
}));

import {
  WizRateLimitProvider,
  isRateLimitError,
  useRateLimitReporter,
  useWizRateLimit,
} from './WizRateLimitContext';
import { WizError } from '../../api/WizClient';
import { WizErrorType } from '../../types';

const rateLimit = () => new WizError(WizErrorType.RATE_LIMITED, 'rate limited');

// Reports its error once on mount, mirroring a widget's async fetch callback
// (never during render).
const Reporter = ({ id, error }: { id: string; error: unknown }) => {
  const report = useRateLimitReporter(id);
  useEffect(() => report(error), [report, error]);
  return null;
};

const Banner = () => {
  const { isRateLimited } = useWizRateLimit();
  return <div data-testid="flag">{isRateLimited ? 'limited' : 'ok'}</div>;
};

describe('WizRateLimitContext', () => {
  it('throws when the hook is used outside a provider', () => {
    // Silence React's error-boundary console noise for the expected throw.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Banner />)).toThrow(/WizRateLimitProvider/);
    spy.mockRestore();
  });

  it('flips to limited when a widget reports a rate-limit error', () => {
    render(
      <WizRateLimitProvider>
        <Banner />
        <Reporter id="a" error={rateLimit()} />
        <Reporter id="b" error={null} />
      </WizRateLimitProvider>,
    );

    expect(screen.getByTestId('flag').textContent).toBe('limited');
  });

  it('stays a single flag regardless of how many widgets are limited', () => {
    render(
      <WizRateLimitProvider>
        <Banner />
        <Reporter id="a" error={rateLimit()} />
        <Reporter id="b" error={rateLimit()} />
        <Reporter id="c" error={rateLimit()} />
      </WizRateLimitProvider>,
    );

    expect(screen.getAllByTestId('flag')).toHaveLength(1);
    expect(screen.getByTestId('flag').textContent).toBe('limited');
  });

  it('reports ok when no widget is rate-limited', () => {
    render(
      <WizRateLimitProvider>
        <Banner />
        <Reporter id="a" error={null} />
        <Reporter
          id="b"
          error={new WizError(WizErrorType.API_ERROR, 'other error')}
        />
      </WizRateLimitProvider>,
    );

    expect(screen.getByTestId('flag').textContent).toBe('ok');
  });

  it('clears stale flags when resetKey changes (entity switch)', () => {
    // Same error identity across renders so the reporter does not re-fire — it
    // reported once for entity A and its fetch for entity B is still in flight.
    const err = rateLimit();
    const { rerender } = render(
      <WizRateLimitProvider resetKey="entity-a">
        <Banner />
        <Reporter id="a" error={err} />
      </WizRateLimitProvider>,
    );

    expect(screen.getByTestId('flag').textContent).toBe('limited');

    // Switching entities must not carry the prior entity's rate-limit panel over,
    // even though the widget stays mounted and has not reported for entity B yet.
    rerender(
      <WizRateLimitProvider resetKey="entity-b">
        <Banner />
        <Reporter id="a" error={err} />
      </WizRateLimitProvider>,
    );

    expect(screen.getByTestId('flag').textContent).toBe('ok');
  });

  it('keeps flags when resetKey is unchanged', () => {
    const err = rateLimit();
    const { rerender } = render(
      <WizRateLimitProvider resetKey="entity-a">
        <Banner />
        <Reporter id="a" error={err} />
      </WizRateLimitProvider>,
    );

    expect(screen.getByTestId('flag').textContent).toBe('limited');

    // A re-render of the same entity must not wipe an active rate-limit flag.
    rerender(
      <WizRateLimitProvider resetKey="entity-a">
        <Banner />
        <Reporter id="a" error={err} />
      </WizRateLimitProvider>,
    );

    expect(screen.getByTestId('flag').textContent).toBe('limited');
  });

  describe('isRateLimitError', () => {
    it('is true only for a RATE_LIMITED WizError', () => {
      expect(isRateLimitError(rateLimit())).toBe(true);
    });

    it('is false for other WizErrors, plain errors, and null', () => {
      expect(isRateLimitError(new WizError(WizErrorType.API_ERROR, 'x'))).toBe(
        false,
      );
      expect(isRateLimitError(new Error('x'))).toBe(false);
      expect(isRateLimitError(null)).toBe(false);
    });
  });
});
