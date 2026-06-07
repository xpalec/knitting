'use client';

import { Calendar } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" description="Content calendar and scheduling for publications" />

      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Calendar size={48} className="mb-4" aria-hidden="true" />
        <p className="text-base font-medium">Coming soon</p>
        <p className="text-sm mt-1">Content calendar will be available in a future update</p>
      </div>
    </div>
  );
}
