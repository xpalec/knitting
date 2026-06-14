import * as React from 'react';

import { cn } from '@/lib/utils';

interface ValidationSummaryProps {
  /** Array of failing error messages. When empty, the component renders nothing. */
  errors: string[];
  className?: string;
}

export function ValidationSummary({
  errors,
  className,
}: ValidationSummaryProps): React.JSX.Element | null {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <ul className="list-disc space-y-1 pl-4 text-sm">
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
