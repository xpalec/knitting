import { cn } from '@/lib/utils';
import type { CategoryType } from '@/lib/api/categories';

interface CategoryTypeBadgeProps {
  type: CategoryType;
}

// Exact colors from design spec
const TYPE_COLORS: Record<CategoryType, { bg: string; color: string }> = {
  entry:        { bg: '#EDE7FF', color: '#7F6BBF' },
  abbreviation: { bg: '#FEF3C7', color: '#B45309' },
  article:      { bg: '#FFEDD5', color: '#C2410C' },
};

export function CategoryTypeBadge({ type }: CategoryTypeBadgeProps) {
  const { bg, color } = TYPE_COLORS[type];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold capitalize min-w-[72px]',
      )}
      style={{ backgroundColor: bg, color }}
    >
      {type}
    </span>
  );
}
