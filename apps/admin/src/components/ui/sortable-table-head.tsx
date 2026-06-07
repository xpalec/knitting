'use client';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableHead } from '@/components/ui/table';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: string | null;
  currentDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

/**
 * A table header cell that supports click-to-sort with direction indicators.
 */
export function SortableTableHead({
  children,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
  className,
}: SortableTableHeadProps) {
  const isActive = currentSort === sortKey;

  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:bg-slate-50 transition-colors', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive && currentDirection === 'asc' ? (
          <ArrowUp size={12} className="text-violet-600" aria-hidden="true" />
        ) : isActive && currentDirection === 'desc' ? (
          <ArrowDown size={12} className="text-violet-600" aria-hidden="true" />
        ) : (
          <ArrowUpDown size={12} className="text-slate-300" aria-hidden="true" />
        )}
      </span>
    </TableHead>
  );
}
