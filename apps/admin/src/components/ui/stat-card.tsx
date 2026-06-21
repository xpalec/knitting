import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  /** Icon element — should be a Lucide icon at size 18 */
  icon: ReactNode;
  /** Tailwind bg + text classes for the icon wrapper, e.g. "bg-violet-50 text-violet-600" */
  iconColor: string;
  /** The numeric or string value to display */
  value: ReactNode;
  /** Label shown below the value */
  label: string;
  /** When true, renders a skeleton placeholder instead of the value */
  isLoading?: boolean;
}

export function StatCard({ icon, iconColor, value, label, isLoading }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className={`rounded-lg p-2.5 ${iconColor}`}>
        {icon}
      </div>
      {isLoading ? (
        <Skeleton className="h-6 w-12" />
      ) : (
        <div>
          <p className="text-xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      )}
    </div>
  );
}
