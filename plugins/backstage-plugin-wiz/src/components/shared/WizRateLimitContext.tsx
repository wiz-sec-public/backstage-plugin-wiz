import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { WizError } from '../../api';
import { WizErrorType } from '../../types';

interface WizRateLimitContextValue {
  /** True when at least one Wiz widget is currently rate-limited. */
  isRateLimited: boolean;
  /** Report (or clear) the rate-limited state for a given widget key. */
  setRateLimited: (key: string, limited: boolean) => void;
}

const WizRateLimitContext = createContext<WizRateLimitContextValue | null>(
  null,
);

/** True only for a RATE_LIMITED WizError. */
export const isRateLimitError = (error: unknown): error is WizError =>
  error instanceof WizError && error.type === WizErrorType.RATE_LIMITED;

/**
 * Tracks which Wiz data widgets are currently rate-limited so the entity tab
 * can render a single consolidated rate-limit state rather than one panel per
 * widget. See WZ-113816.
 *
 * `resetKey` identifies the entity being displayed. The provider stays mounted
 * across entity switches (only the entity's ids change), so without a reset a
 * prior entity's rate-limit flags would leak into the next one and show the
 * consolidated panel for the wrong entity. When `resetKey` changes we drop all
 * flags during render (React's documented "adjust state on prop change"
 * pattern) so the new entity starts clean with no stale frame. See WZ-113816.
 */
export const WizRateLimitProvider = ({
  resetKey,
  children,
}: {
  resetKey?: string;
  children: ReactNode;
}) => {
  const [limitedKeys, setLimitedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (limitedKeys.size > 0) setLimitedKeys(new Set());
  }

  const setRateLimited = useCallback((key: string, limited: boolean) => {
    setLimitedKeys(prev => {
      if (limited === prev.has(key)) return prev;
      const next = new Set(prev);
      if (limited) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ isRateLimited: limitedKeys.size > 0, setRateLimited }),
    [limitedKeys, setRateLimited],
  );

  return (
    <WizRateLimitContext.Provider value={value}>
      {children}
    </WizRateLimitContext.Provider>
  );
};

export function useWizRateLimit(): WizRateLimitContextValue {
  const contextValue = useContext(WizRateLimitContext);
  if (!contextValue) {
    throw new Error(
      'useWizRateLimit must be used inside a WizRateLimitProvider',
    );
  }
  return contextValue;
}

/**
 * Returns a reporter that a widget calls with its fetch result: a RATE_LIMITED
 * WizError marks the widget as rate-limited, anything else clears it. Reporting
 * happens from the widget's async fetch callback (not during render), so the
 * provider update never collides with a render. The only effect here clears the
 * widget's report on unmount. See WZ-113816.
 */
export function useRateLimitReporter(key: string) {
  const { setRateLimited } = useWizRateLimit();

  useEffect(() => () => setRateLimited(key, false), [key, setRateLimited]);

  return useCallback(
    (error: unknown) => setRateLimited(key, isRateLimitError(error)),
    [key, setRateLimited],
  );
}
