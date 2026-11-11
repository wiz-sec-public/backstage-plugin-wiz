import { WizError, WizErrorType } from '../types';

export interface WizOrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

// Wiz IssueOrder.field values used by the issues table.
export const ISSUE_ORDER_FIELDS: ReadonlySet<string> = new Set([
  'CREATED_AT',
  'SEVERITY',
  'STATUS',
]);

// Wiz VulnerabilityFindingOrder.field values used by the vulnerabilities table.
export const VULNERABILITY_ORDER_FIELDS: ReadonlySet<string> = new Set([
  'FIRST_DETECTED_AT',
  'LAST_DETECTED_AT',
  'RELATED_ISSUE_SEVERITY',
  'SEVERITY',
]);

export const DEFAULT_ISSUE_ORDER: WizOrderBy = {
  field: 'SEVERITY',
  direction: 'DESC',
};

export const DEFAULT_VULNERABILITY_ORDER: WizOrderBy = {
  field: 'RELATED_ISSUE_SEVERITY',
  direction: 'DESC',
};

function readQueryString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new WizError(WizErrorType.INVALID_REQUEST, `Invalid ${name}`, 400);
  }
  return value;
}

// Reads orderByField and orderByDirection from the request query.
// Both omitted keeps the fallback. An unknown field or direction is rejected
// so the GraphQL call is not sent with an enum Wiz will refuse.
export function parseOrderBy(
  query: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  fallback: WizOrderBy,
): WizOrderBy {
  const field = readQueryString(query.orderByField, 'orderByField');
  const direction = readQueryString(query.orderByDirection, 'orderByDirection');

  if (field === undefined && direction === undefined) {
    return fallback;
  }
  if (field === undefined || !allowedFields.has(field)) {
    throw new WizError(
      WizErrorType.INVALID_REQUEST,
      'Invalid orderByField',
      400,
    );
  }
  if (direction !== undefined && direction !== 'ASC' && direction !== 'DESC') {
    throw new WizError(
      WizErrorType.INVALID_REQUEST,
      'Invalid orderByDirection',
      400,
    );
  }

  return {
    field,
    direction: direction ?? 'DESC',
  };
}
