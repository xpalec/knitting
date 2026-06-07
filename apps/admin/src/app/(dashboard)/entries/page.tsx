'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  FileX,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { entriesApi } from '@/lib/api/entries';
import type { EntryStatus, SkillLevel, Entry } from '@/lib/api/entries';

import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/ui/pagination';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 10;

const STATUS_OPTIONS: { value: EntryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'published', label: 'Published' },
  { value: 'deprecated', label: 'Deprecated' },
];

const SKILL_OPTIONS: { value: SkillLevel | 'all'; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const LANGUAGE_OPTIONS: { value: string }[] = [
  { value: 'all' },
  { value: 'en' },
  { value: 'pl' },
  { value: 'no' },
  { value: 'de' },
  { value: 'fr' },
];

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<EntryStatus, { bg: string; color: string }> = {
  draft:      { bg: '#F1F5F9', color: '#64748B' },
  review:     { bg: '#FEF9C3', color: '#A16207' },
  published:  { bg: '#EAF6F0', color: '#63A48B' },
  deprecated: { bg: '#FEE2E2', color: '#DC2626' },
};

const SKILL_COLORS: Record<SkillLevel, { bg: string; color: string }> = {
  beginner:     { bg: '#EAF6F0', color: '#63A48B' },
  intermediate: { bg: '#DBEAFE', color: '#1D4ED8' },
  advanced:     { bg: '#FFEDD5', color: '#C2410C' },
  expert:       { bg: '#FEE2E2', color: '#DC2626' },
};

function StatusBadge({ status }: { status: EntryStatus }) {
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold capitalize min-w-[72px]"
      style={{ backgroundColor: bg, color }}
    >
      {status}
    </span>
  );
}

function SkillBadge({ level }: { level?: SkillLevel }) {
  if (!level) return <span className="text-slate-400 text-xs">—</span>;
  const { bg, color } = SKILL_COLORS[level];
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold capitalize min-w-[72px]"
      style={{ backgroundColor: bg, color }}
    >
      {level}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Change Status Dialog
// ---------------------------------------------------------------------------

interface ChangeStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: EntryStatus;
  onConfirm: (status: EntryStatus) => void;
  loading: boolean;
}

function ChangeStatusDialog({
  open,
  onOpenChange,
  currentStatus,
  onConfirm,
  loading,
}: ChangeStatusDialogProps) {
  const [selected, setSelected] = useState<EntryStatus>(currentStatus);

  useEffect(() => {
    if (open) setSelected(currentStatus);
  }, [open, currentStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>Change Status</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Select
            value={selected}
            onValueChange={(v) => setSelected(v as EntryStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.filter((o) => o.value !== 'all').map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-4 w-36" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-8" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-8 rounded" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEnTerm(entry: Entry): string {
  // List responses return a flat `term` field; detail responses include translations[]
  if (entry.term) return entry.term;
  const translations = entry.translations ?? [];
  return (
    translations.find((t) => t.locale === 'en')?.term ??
    translations[0]?.term ??
    '—'
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EntriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<EntryStatus | 'all'>('all');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | 'all'>('all');
  const [originLanguage, setOriginLanguage] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [statusTarget, setStatusTarget] = useState<Entry | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [status, skillLevel, originLanguage]);

  // Build query params
  const params = {
    page,
    limit: pageSize,
    ...(q ? { q } : {}),
    ...(status !== 'all' ? { status } : {}),
    ...(skillLevel !== 'all' ? { skillLevel } : {}),
    ...(originLanguage !== 'all' ? { originLanguage } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['entries', params],
    queryFn: () => entriesApi.listEntries(params),
  });

  const entries = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => entriesApi.deleteEntry(id),
    onSuccess: () => {
      toast.success('Entry deleted');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Failed to delete entry');
    },
  });

  // Status mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EntryStatus }) =>
      entriesApi.updateEntryStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      setStatusTarget(null);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Entries"
        description="Manage encyclopedia entries, translations and content blocks"
      >
        <Button
          variant="outline"
          className="gap-2 border-violet-500 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
        >
          <Search size={16} aria-hidden="true" />
          Filters
        </Button>
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/entries/new">
            <Plus size={16} aria-hidden="true" />
            Add
          </Link>
        </Button>
      </PageHeader>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
          <BookOpen size={18} aria-hidden="true" />
        </div>
        {isLoading ? (
          <Skeleton className="h-4 w-28" />
        ) : (
          <span>
            <span className="font-semibold text-slate-800">{total}</span>{' '}
            {total === 1 ? 'Entry' : 'Entries'} total
          </span>
        )}
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                placeholder="Search entries…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status */}
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as EntryStatus | 'all')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Skill level */}
            <Select
              value={skillLevel}
              onValueChange={(v) => setSkillLevel(v as SkillLevel | 'all')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SKILL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Origin language */}
            <Select
              value={originLanguage}
              onValueChange={(v) => setOriginLanguage(v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.value === 'all' ? 'All Languages' : o.value.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Skill Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileX size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm font-medium">No entries found</p>
                      <p className="text-xs mt-1">
                        Try adjusting your filters or search query
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow
                    key={entry.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/entries/${entry.id}`)}
                  >
                    <TableCell className="font-medium text-slate-700 max-w-[220px] truncate">
                      {getEnTerm(entry)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs uppercase">
                        {entry.origin_language}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <SkillBadge level={entry.metadata.skill_level} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap">
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      className="text-right"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Row actions"
                          >
                            <MoreHorizontal size={16} aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/entries/${entry.id}`)
                            }
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setStatusTarget(entry)}
                          >
                            <RefreshCw size={14} aria-hidden="true" />
                            Change Status
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {!isLoading && entries.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Entry"
        description={`Are you sure you want to delete "${deleteTarget ? getEnTerm(deleteTarget) : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />

      {/* Change status dialog */}
      {statusTarget && (
        <ChangeStatusDialog
          open={statusTarget !== null}
          onOpenChange={(open) => !open && setStatusTarget(null)}
          currentStatus={statusTarget.status}
          onConfirm={(newStatus) =>
            statusMutation.mutate({ id: statusTarget.id, status: newStatus })
          }
          loading={statusMutation.isPending}
        />
      )}
    </div>
  );
}
