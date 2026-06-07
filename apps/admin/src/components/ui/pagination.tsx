'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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
 * Pagination matching the design:
 *
 * Inside the table card border (TableFooter bar):
 *   Left:  "2 selected"
 *   Right: "Show 10 ▾ per page"
 *
 * Below the card:
 *   Left:  "1–10 of 140 items"
 *   Right: ← Previous  1  [2]  3  …  Next →
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

  function getPageNumbers(): (number | 'ellipsis')[] {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | 'ellipsis')[] = [1];
    if (page > 3) pages.push('ellipsis');
    const rangeStart = Math.max(2, page - 1);
    const rangeEnd = Math.min(totalPages - 1, page + 1);
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="space-y-0">
      {/* ── Row 1: inside the table card border ─────────────────────── */}
      {/* This row is rendered as a TableFooter in the consuming component.
          We expose it as a named export so the page can slot it in.      */}

      {/* ── Row 2: below the card — 3-column grid so page buttons are centered ── */}
      <div className="grid grid-cols-3 items-center px-1 pt-3">
        {/* Left: item range */}
        <p className="text-sm text-slate-500">
          {start}–{end} of{' '}
          <span className="font-medium text-slate-700">{total}</span> items
        </p>

        {/* Center: page buttons */}
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            Previous
          </button>

          {getPageNumbers().map((item, idx) => {
            if (item === 'ellipsis') {
              return (
                <span key={`e-${idx}`} className="px-1 text-slate-400 text-sm select-none">
                  …
                </span>
              );
            }
            const isActive = item === page;
            return (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'h-8 w-8 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {item}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Right: intentionally empty to balance the grid */}
        <div />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TableFooterBar — "2 selected | Show 10 ▾ per page" row inside the card
// Used inside a <TableFooter> in the consuming page.
// ---------------------------------------------------------------------------

interface TableFooterBarProps {
  selectedCount?: number;
  pageSize: number;
  onPageSizeChange?: (size: number) => void;
}

export function TableFooterBar({ selectedCount = 0, pageSize, onPageSizeChange }: TableFooterBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      {/* Left: selected count */}
      <p className="text-sm text-slate-500">
        {selectedCount > 0 ? (
          <><span className="font-medium text-slate-700">{selectedCount}</span> selected</>
        ) : (
          <span className="invisible">0 selected</span> // keeps height stable
        )}
      </p>

      {/* Right: page size */}
      {onPageSizeChange && (
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1"
            aria-label="Items per page"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>per page</span>
        </div>
      )}
    </div>
  );
}
