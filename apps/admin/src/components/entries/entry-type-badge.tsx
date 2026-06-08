import { cn } from '@/lib/utils';

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  stitch:      { bg: '#EDE7FF', color: '#7F6BBF' },
  technique:   { bg: '#DBEAFE', color: '#1D4ED8' },
  tool:        { bg: '#FEF3C7', color: '#B45309' },
  tradition:   { bg: '#D1FAE5', color: '#065F46' },
  yarn_weight: { bg: '#FCE7F3', color: '#9D174D' },
};

const NEUTRAL = { bg: '#F1F5F9', color: '#64748B' };

const TYPE_LABELS: Record<string, string> = {
  stitch:      'Stitch',
  technique:   'Technique',
  tool:        'Tool',
  tradition:   'Tradition',
  yarn_weight: 'Yarn Weight',
};

interface EntryTypeBadgeProps {
  type: string;
}

export function EntryTypeBadge({ type }: EntryTypeBadgeProps) {
  const { bg, color } = TYPE_COLORS[type] ?? NEUTRAL;
  const label = TYPE_LABELS[type] ?? type;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold min-w-[72px]',
      )}
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}
