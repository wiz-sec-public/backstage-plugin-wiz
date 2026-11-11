import { TableCell, TableSortLabel } from '@mui/material';
import { ColumnSort, SortDirection } from './columnSort';

interface SortableHeaderCellProps {
  label: string;
  field: string;
  sort: ColumnSort;
  defaultDirection: SortDirection;
  onSort: (field: string, defaultDirection: SortDirection) => void;
}

export const SortableHeaderCell = ({
  label,
  field,
  sort,
  defaultDirection,
  onSort,
}: SortableHeaderCellProps) => {
  const active = sort.field === field;

  return (
    <TableCell
      sx={{ fontWeight: 600 }}
      sortDirection={active ? sort.direction : false}
    >
      <TableSortLabel
        active={active}
        direction={active ? sort.direction : defaultDirection}
        onClick={() => onSort(field, defaultDirection)}
        sx={{ fontWeight: 600 }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
};
