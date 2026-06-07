import { cn } from '@/lib/utils';
import type { CategoryStatus } from '@/lib/api/categories';

interface CategoryStatusBadgeProps {
  status: CategoryStatus;
}

// Exact colors matching the design's pastel badge palette
const STATUS_COLORS: Record<CategoryStatus, { bg: string; color: string }> = {
  published: { bg: '#EAF6F0', color: '#63A48B' },
  draft:     { bg: '#FFEDD5', color: '#C2410C' },
};

export function CategoryStatusBadge({ status }: CategoryStatusBadgeProps) {
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold capitalize min-w-[72px]',
      )}
      style={{ backgroundColor: bg, color }}
    >
      {status}
    </span>
  );
}
