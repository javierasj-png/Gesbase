import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { SortDirection } from '@/hooks/useTableSort';
import { cn } from '@/lib/utils';

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSortKey: string;
  direction: SortDirection;
  onSort: (key: string) => void;
  children: React.ReactNode;
}

export function SortableTableHead({
  sortKey,
  currentSortKey,
  direction,
  onSort,
  children,
  className,
  ...props
}: SortableTableHeadProps) {
  const isActive = currentSortKey === sortKey && direction !== null;

  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-muted/50 transition-colors', className)}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {isActive ? (
          direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
        )}
      </div>
    </TableHead>
  );
}
