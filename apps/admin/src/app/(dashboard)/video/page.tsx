'use client';

import { Video } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function VideoPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Video" description="Manage video content and tutorials" />

      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Video size={48} className="mb-4" aria-hidden="true" />
        <p className="text-base font-medium">Coming soon</p>
        <p className="text-sm mt-1">Video management will be available in a future update</p>
      </div>
    </div>
  );
}
