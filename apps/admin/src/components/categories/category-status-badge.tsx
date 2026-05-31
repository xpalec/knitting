import { Badge } from '@/components/ui/badge';
import type { CategoryStatus } from '@/lib/api/categories';

interface CategoryStatusBadgeProps {
  status: CategoryStatus;
}

const STATUS_STYLES: Record<CategoryStatus, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  published: 'bg-green-50 text-green-700 border-green-200',
};

export function CategoryStatusBadge({ status }: CategoryStatusBadgeProps) {
  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {status}
    </Badge>
  );
}
