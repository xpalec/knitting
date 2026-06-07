'use client';

import { Layers } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function EntryTemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Entry Templates" description="Manage reusable content block templates for encyclopedia entries" />

      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Layers size={48} className="mb-4" aria-hidden="true" />
        <p className="text-base font-medium">Coming soon</p>
        <p className="text-sm mt-1">Entry templates will be available in a future update</p>
      </div>
    </div>
  );
}
