'use client';

import { CaseSensitive } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function AbbreviationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Abbreviations" description="Manage knitting abbreviations and their translations across languages" />

      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <CaseSensitive size={48} className="mb-4" aria-hidden="true" />
        <p className="text-base font-medium">Coming soon</p>
        <p className="text-sm mt-1">Abbreviation management will be available in a future update</p>
      </div>
    </div>
  );
}
