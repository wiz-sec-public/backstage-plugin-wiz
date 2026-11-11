import { nextColumnSort, toApiOrder } from './columnSort';

describe('nextColumnSort', () => {
  const severity = { field: 'SEVERITY', direction: 'desc' as const };

  it('selects a new column with its default direction', () => {
    expect(nextColumnSort(severity, 'CREATED_AT', 'desc')).toEqual({
      field: 'CREATED_AT',
      direction: 'desc',
    });
  });

  it('flips direction when the active column is clicked again', () => {
    expect(nextColumnSort(severity, 'SEVERITY', 'desc')).toEqual({
      field: 'SEVERITY',
      direction: 'asc',
    });
    expect(
      nextColumnSort(
        { field: 'SEVERITY', direction: 'asc' },
        'SEVERITY',
        'desc',
      ),
    ).toEqual({
      field: 'SEVERITY',
      direction: 'desc',
    });
  });
});

describe('toApiOrder', () => {
  it('uppercases the direction for the Wiz API', () => {
    expect(toApiOrder({ field: 'STATUS', direction: 'asc' })).toEqual({
      field: 'STATUS',
      direction: 'ASC',
    });
  });
});
