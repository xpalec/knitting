'use client';

import { Tags } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function ContentTagsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Content Tags" description="Manage tags for articles, videos, and other content" />

      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <Tags size={48} className="mb-4" aria-hidden="true" />
        <p className="text-base font-medium">Coming soon</p>
        <p className="text-sm mt-1">Content tags will be available in a future update</p>
      </div>
    </div>
  );
}
