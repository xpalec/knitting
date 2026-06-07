'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  selectedCount?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/**
 * Full-featured pagination matching the design:
 * - Left: "X selected" + "1-10 of 140 items"
 * - Center/Right: Previous, numbered pages with ellipsis, Next
 * - Right: "Show N per page" dropdown
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  selectedCount = 0,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  // Build page number array with ellipsis
  function getPageNumbers(): (number | 'ellipsis')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    if (page > 3) {
      pages.push('ellipsis');
    }

    const rangeStart = Math.max(2, page - 1);
    const rangeEnd = Math.min(totalPages - 1, page + 1);

    for (let i = rangeStart; i <= rangeEnd; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push('ellipsis');
    }

    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Left section: selected count + item range */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        {selectedCount > 0 && (
          <span>
            <span className="font-medium text-slate-700">{selectedCount}</span> selected
          </span>
        )}
        <span>
          {start}-{end} of <span className="font-medium text-slate-700">{total}</span> items
        </span>
      </div>

      {/* Right section: page navigation + page size */}
      <div className="flex items-center gap-2">
        {/* Previous */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="gap-1"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </Button>

        {/* Page numbers */}
        {getPageNumbers().map((item, idx) => {
          if (item === 'ellipsis') {
            return (
              <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 text-sm">
                …
              </span>
            );
          }
          return (
            <Button
              key={item}
              variant={item === page ? 'default' : 'outline'}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => onPageChange(item)}
            >
              {item}
            </Button>
          );
        })}

        {/* Next */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="gap-1"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </Button>

        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2 text-sm text-slate-500">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
              aria-label="Items per page"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>per page</span>
          </div>
        )}
      </div>
    </div>
  );
}
