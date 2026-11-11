import { WizError, WizErrorType } from '../types';
import {
  DEFAULT_ISSUE_ORDER,
  ISSUE_ORDER_FIELDS,
  parseOrderBy,
} from './orderBy';

describe('parseOrderBy', () => {
  it('returns the fallback when the query omits both parameters', () => {
    expect(parseOrderBy({}, ISSUE_ORDER_FIELDS, DEFAULT_ISSUE_ORDER)).toEqual(
      DEFAULT_ISSUE_ORDER,
    );
  });

  it('accepts an allowed field and direction', () => {
    expect(
      parseOrderBy(
        { orderByField: 'CREATED_AT', orderByDirection: 'ASC' },
        ISSUE_ORDER_FIELDS,
        DEFAULT_ISSUE_ORDER,
      ),
    ).toEqual({ field: 'CREATED_AT', direction: 'ASC' });
  });

  it('defaults the direction to DESC when only the field is set', () => {
    expect(
      parseOrderBy(
        { orderByField: 'STATUS' },
        ISSUE_ORDER_FIELDS,
        DEFAULT_ISSUE_ORDER,
      ),
    ).toEqual({ field: 'STATUS', direction: 'DESC' });
  });

  it('rejects a field Wiz cannot order by', () => {
    expect(() =>
      parseOrderBy(
        { orderByField: 'RESOURCE_NAME', orderByDirection: 'ASC' },
        ISSUE_ORDER_FIELDS,
        DEFAULT_ISSUE_ORDER,
      ),
    ).toThrow(WizError);
    try {
      parseOrderBy(
        { orderByField: 'RESOURCE_NAME' },
        ISSUE_ORDER_FIELDS,
        DEFAULT_ISSUE_ORDER,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(WizError);
      expect((error as WizError).type).toBe(WizErrorType.INVALID_REQUEST);
    }
  });

  it('rejects an unknown direction', () => {
    expect(() =>
      parseOrderBy(
        { orderByField: 'SEVERITY', orderByDirection: 'SIDEWAYS' },
        ISSUE_ORDER_FIELDS,
        DEFAULT_ISSUE_ORDER,
      ),
    ).toThrow(WizError);
  });
});
