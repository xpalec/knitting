'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Inbox,
  Globe,
  Languages,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiGet } from '@/lib/api/client';
import { dashboardApi } from '@/lib/api/dashboard';
import type { QueueEntry } from '@/lib/api/queue';

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description: string;
  href?: string;
  linkLabel?: string;
  loading?: boolean;
  iconColor?: string;
}

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  href,
  linkLabel,
  loading,
  iconColor = 'text-blue-600',
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        <div className={`rounded-lg bg-slate-50 p-2 ${iconColor}`}>
          <Icon size={18} aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20 mb-1" />
        ) : (
          <p className="text-3xl font-bold text-slate-800">{value}</p>
        )}
        <p className="text-xs text-slate-500 mt-1">{description}</p>
        {href && linkLabel && (
          <Link
            href={href}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {linkLabel}
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status badge for recent activity table
// ---------------------------------------------------------------------------

interface StatusConfig {
  label: string;
  icon: React.ElementType;
  className: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-green-50 text-green-700 border-green-200',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

const DEFAULT_STATUS_CONFIG: StatusConfig = STATUS_CONFIG.pending;

function StatusBadge({ status }: { status: string }) {
  const config: StatusConfig = STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.className}`}
    >
      <Icon size={11} aria-hidden="true" />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  const { data: recentItems, isLoading: loadingRecent } = useQuery({
    queryKey: ['dashboard', 'recent-queue'],
    queryFn: () => apiGet<QueueEntry[]>('/api/v1/admin/queue/entries?limit=10'),
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of the encyclopedia content</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Published Entries"
          value={stats?.publishedEntries ?? 0}
          icon={BookOpen}
          description="Live in the encyclopedia"
          href="/entries"
          linkLabel="View all"
          loading={loadingStats}
          iconColor="text-blue-600"
        />
        <StatCard
          title="Pending Submissions"
          value={stats?.pendingQueueItems ?? 0}
          icon={Inbox}
          description="Awaiting review"
          href="/queue"
          linkLabel="Review queue"
          loading={loadingStats}
          iconColor="text-yellow-600"
        />
        <StatCard
          title="EN Coverage"
          value={loadingStats ? '--' : `${stats?.enCoverage ?? 0}%`}
          icon={Globe}
          description="Entries with English translation"
          loading={loadingStats}
          iconColor="text-green-600"
        />
        <StatCard
          title="PL Coverage"
          value={loadingStats ? '--' : `${stats?.plCoverage ?? 0}%`}
          icon={Languages}
          description="Entries with Polish translation"
          loading={loadingStats}
          iconColor="text-purple-600"
        />
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800">
            Recent Submissions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingRecent ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !recentItems || recentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Inbox size={32} className="mb-2" aria-hidden="true" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Term
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentItems.map((item) => {
                    const term =
                      (item.payload?.term as string) ??
                      (item.payload?.translated_term as string) ??
                      '—';
                    const date = new Date(item.submitted_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="text-xs capitalize">
                            {item.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700 max-w-[200px] truncate">
                          {term}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-slate-500">{date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
