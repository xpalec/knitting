import { cn } from '@/lib/utils';

// Exact pastel tile colors per locale — rounded square, not circle
const LOCALE_COLORS: Record<string, { bg: string; color: string }> = {
  en: { bg: '#E6F4EF', color: '#4A9B7F' },
  pl: { bg: '#FDF0E6', color: '#C07033' },
  fr: { bg: '#EEEEF2', color: '#8B8FA8' },
  de: { bg: '#EEEEF2', color: '#8B8FA8' },
  no: { bg: '#E8EEF8', color: '#5B7AB0' },
};

const FALLBACK = { bg: '#EEEEF2', color: '#8B8FA8' };

// When a translation status is provided, override the tile color to reflect completeness
const STATUS_OVERRIDES: Record<string, { bg: string; color: string }> = {
  complete:   { bg: '#DCFCE7', color: '#15803D' }, // green
  incomplete: { bg: '#FEF9C3', color: '#A16207' }, // amber
  missing:    { bg: '#F1F5F9', color: '#94A3B8' }, // slate / greyed out
};

export type LocaleTranslationStatus = 'complete' | 'incomplete' | 'missing';

interface LanguageBadgesProps {
  locales: string[];
  /** Optional per-locale translation status. When provided, tile color reflects completeness. */
  statuses?: Partial<Record<string, LocaleTranslationStatus>>;
  className?: string;
}

export function LanguageBadges({ locales, statuses, className }: LanguageBadgesProps) {
  if (!locales || locales.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {locales.map((locale) => {
        const status = statuses?.[locale];
        const { bg, color } = status
          ? (STATUS_OVERRIDES[status] ?? FALLBACK)
          : (LOCALE_COLORS[locale] ?? FALLBACK);
        const label = locale.charAt(0).toUpperCase() + locale.charAt(1);
        const title = status
          ? `${locale.toUpperCase()} — ${status.charAt(0).toUpperCase() + status.slice(1)}`
          : locale.toUpperCase();
        return (
          <span
            key={locale}
            className="inline-flex items-center justify-center h-6 w-6 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: bg, color }}
            title={title}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
