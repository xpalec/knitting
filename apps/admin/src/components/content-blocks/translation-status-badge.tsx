import { Check, AlertCircle, Minus } from 'lucide-react';
import type { TranslationStatus } from '@/lib/api/content-block-types';

const STATUS_CONFIG: Record<TranslationStatus, {
  icon: React.ElementType;
  label: string;
  className: string;
}> = {
  complete:   { icon: Check,       label: 'Complete',   className: 'text-green-600' },
  incomplete: { icon: AlertCircle, label: 'Incomplete', className: 'text-amber-500' },
  missing:    { icon: Minus,       label: 'Missing',    className: 'text-slate-400' },
};

interface TranslationStatusBadgeProps {
  status: TranslationStatus;
}

export function TranslationStatusBadge({ status }: TranslationStatusBadgeProps) {
  const { icon: Icon, label, className } = STATUS_CONFIG[status];
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={label}>
      <Icon className={`h-4 w-4 ${className}`} aria-hidden="true" />
      <span className={`text-xs font-medium ${className}`}>{label}</span>
    </span>
  );
}

export default TranslationStatusBadge;
