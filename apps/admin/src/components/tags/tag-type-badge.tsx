import { Badge } from '@/components/ui/badge';
import type { TagType } from '@/lib/api/tags';

interface TagTypeBadgeProps {
  type: TagType | null;
}

const TYPE_STYLES: Record<TagType, string> = {
  fiber_type:      'bg-purple-50 text-purple-700 border-purple-200',
  needle_type:     'bg-blue-50 text-blue-700 border-blue-200',
  garment_part:    'bg-amber-50 text-amber-700 border-amber-200',
  style_tradition: 'bg-green-50 text-green-700 border-green-200',
};

const TYPE_LABELS: Record<TagType, string> = {
  fiber_type:      'Fiber Type',
  needle_type:     'Needle Type',
  garment_part:    'Garment Part',
  style_tradition: 'Style Tradition',
};

export function TagTypeBadge({ type }: TagTypeBadgeProps) {
  if (!type) {
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
        —
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={TYPE_STYLES[type]}>
      {TYPE_LABELS[type]}
    </Badge>
  );
}
