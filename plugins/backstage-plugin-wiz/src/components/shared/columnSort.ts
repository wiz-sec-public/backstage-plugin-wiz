import { WizOrderBy } from '../../api/WizAPI';

export type SortDirection = 'asc' | 'desc';

export interface ColumnSort {
  field: string;
  direction: SortDirection;
}

// Clicking the active column flips direction. Clicking another column
// selects it and applies that column's default direction.
export function nextColumnSort(
  current: ColumnSort,
  field: string,
  defaultDirection: SortDirection,
): ColumnSort {
  if (current.field === field) {
    return {
      field,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    };
  }
  return { field, direction: defaultDirection };
}

export function toApiOrder(sort: ColumnSort): WizOrderBy {
  return {
    field: sort.field,
    direction: sort.direction === 'asc' ? 'ASC' : 'DESC',
  };
}
