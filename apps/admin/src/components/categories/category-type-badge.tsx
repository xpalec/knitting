import { Badge } from '@/components/ui/badge';
import type { CategoryType } from '@/lib/api/categories';

interface CategoryTypeBadgeProps {
  type: CategoryType;
}

const TYPE_STYLES: Record<CategoryType, string> = {
  entry:        'bg-blue-50 text-blue-700 border-blue-200',
  abbreviation: 'bg-amber-50 text-amber-700 border-amber-200',
  article:      'bg-green-50 text-green-700 border-green-200',
};

export function CategoryTypeBadge({ type }: CategoryTypeBadgeProps) {
  return (
    <Badge variant="outline" className={TYPE_STYLES[type]}>
      {type}
    </Badge>
  );
}
