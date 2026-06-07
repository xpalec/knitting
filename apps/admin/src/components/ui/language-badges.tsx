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

interface LanguageBadgesProps {
  locales: string[];
  className?: string;
}

export function LanguageBadges({ locales, className }: LanguageBadgesProps) {
  if (!locales || locales.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {locales.map((locale) => {
        const { bg, color } = LOCALE_COLORS[locale] ?? FALLBACK;
        const label = locale.charAt(0).toUpperCase() + locale.charAt(1);
        return (
          <span
            key={locale}
            className="inline-flex items-center justify-center h-6 w-6 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: bg, color }}
            title={locale.toUpperCase()}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}
