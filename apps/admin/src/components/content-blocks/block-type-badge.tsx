import { cn } from '@/lib/utils';
import { BLOCK_TYPE_OPTIONS } from '@/lib/api/content-block-types';

// Pastel color palette cycling through block types
const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  rich_text:  { bg: '#EDE7FF', color: '#7F6BBF' },
  callout:    { bg: '#FEF3C7', color: '#B45309' },
  steps:      { bg: '#DCFCE7', color: '#16A34A' },
  key_facts:  { bg: '#E0F2FE', color: '#0369A1' },
  video:      { bg: '#FFE4E6', color: '#BE123C' },
  image:      { bg: '#FEF9C3', color: '#A16207' },
  relations:  { bg: '#FFEDD5', color: '#C2410C' },
  pattern:    { bg: '#F0FDF4', color: '#15803D' },
};

const FALLBACK = { bg: '#EEEEF2', color: '#8B8FA8' };

interface BlockTypeBadgeProps {
  type: string;
}

export function BlockTypeBadge({ type }: BlockTypeBadgeProps) {
  const { bg, color } = TYPE_COLORS[type] ?? FALLBACK;
  const label =
    BLOCK_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold whitespace-nowrap',
      )}
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}
