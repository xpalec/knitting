'use client';

import { Map } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function MapPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Map" description="Geographic visualization of knitting traditions and techniques" />

      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Map size={48} className="mb-4" aria-hidden="true" />
        <p className="text-base font-medium">Coming soon</p>
        <p className="text-sm mt-1">Map view will be available in a future update</p>
      </div>
    </div>
  );
}
