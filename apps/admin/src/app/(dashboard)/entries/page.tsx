'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle,
  FileText,
  Clock,
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  FileX,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { entriesApi, listEntryCategories } from '@/lib/api/entries';
import type { EntryStatus, Entry } from '@/lib/api/entries';
import { entryTemplatesApi } from '@/lib/api/entry-templates';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import type { SortDirection } from '@/components/ui/sortable-table-head';
import { LanguageBadges } from '@/components/ui/language-badges';

import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination, TableFooterBar } from '@/components/ui/pagination';

import { Button } from '@/components/ui/button';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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

// ---------------------------------------------------------------------------
// Status tab mappings
// ---------------------------------------------------------------------------

// Maps the current statusFilter to the Tabs value prop.
// 'deprecated' has no dedicated tab -> use 'deprecated' so no TabsTrigger matches.
const STATUS_TO_TAB: Record<EntryStatus | 'all', string> = {
  all:        'all',
  published:  'published',
  draft:      'draft',
  review:     'needs-review',
  deprecated: 'deprecated',
};

// Maps a tab value back to the EntryStatus filter value.
const TAB_TO_STATUS: Record<string, EntryStatus | 'all'> = {
  'all':          'all',
  'published':    'published',
  'draft':        'draft',
  'needs-review': 'review',
};

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<EntryStatus, { bg: string; color: string }> = {
  draft:      { bg: '#F1F5F9', color: '#64748B' },
  review:     { bg: '#FEF9C3', color: '#A16207' },
  published:  { bg: '#EAF6F0', color: '#63A48B' },
  deprecated: { bg: '#FEE2E2', color: '#DC2626' },
};

const STATUS_LABELS: Record<EntryStatus, string> = {
  draft:      'Draft',
  review:     'Needs review',
  published:  'Published',
  deprecated: 'Deprecated',
};

function StatusBadge({ status }: { status: EntryStatus }) {
  const { bg, color } = STATUS_COLORS[status];
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold min-w-[72px]"
      style={{ backgroundColor: bg, color }}
    >
      {STATUS_LABELS[status]}
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
            {loading ? 'Saving...' : 'Save'}
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
          {/* Checkbox */}
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          {/* Title */}
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          {/* Type */}
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          {/* Category */}
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          {/* Tags */}
          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-12 rounded-full" /><Skeleton className="h-5 w-12 rounded-full" /></div></TableCell>
          {/* Status */}
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          {/* Updated */}
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          {/* Languages */}
          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-5 w-5 rounded-full" /></div></TableCell>
          {/* Actions */}
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Page
// ---------------------------------------------------------------------------

export default function EntriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntryStatus | 'all'>('all');
  const [templateFilter, setTemplateFilter] = useState<string | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Sort
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      // Cycle: asc -> desc -> unsorted
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortKey(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null);
  const [statusTarget, setStatusTarget] = useState<Entry | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Ref for hidden file input (Import)
  const importInputRef = useRef<HTMLInputElement>(null);

  // Import handlers
  function handleImportClick() {
    importInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB = 5,242,880 bytes
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (!isCSV) {
      toast.error('Invalid file type. Please select a .csv file.');
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_SIZE) {
      toast.error('File is too large. Maximum allowed size is 5 MB.');
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }

    // File is valid - actual import API not yet implemented
    toast.success('File ready for import');
    if (importInputRef.current) importInputRef.current.value = '';
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Summary queries - four parallel queries, independent of filter state
  const summaryQueries = useQueries({
    queries: [
      {
        queryKey: ['entries-summary', 'all'] as const,
        queryFn: () => entriesApi.listEntries({ limit: 1 }),
      },
      {
        queryKey: ['entries-summary', 'published'] as const,
        queryFn: () => entriesApi.listEntries({ limit: 1, status: 'published' as EntryStatus }),
      },
      {
        queryKey: ['entries-summary', 'draft'] as const,
        queryFn: () => entriesApi.listEntries({ limit: 1, status: 'draft' as EntryStatus }),
      },
      {
        queryKey: ['entries-summary', 'review'] as const,
        queryFn: () => entriesApi.listEntries({ limit: 1, status: 'review' as EntryStatus }),
      },
    ],
  });

  // Build list query params from all active filter/page/sort values
  const params = {
    page,
    limit: pageSize,
    ...(q ? { q } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(templateFilter !== 'all' ? { template_id: templateFilter } : {}),
    ...(categoryFilter !== 'all' ? { category_id: categoryFilter } : {}),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['entries', params],
    queryFn: () => entriesApi.listEntries(params),
  });

  // Categories query for the filter dropdown
  const { data: catData, isLoading: catLoading, isError: catError } = useQuery({
    queryKey: ['entry-categories'],
    queryFn: () => listEntryCategories(),
  });

  // Templates query for the filter dropdown
  const { data: templatesData } = useQuery({
    queryKey: ['entry-templates'],
    queryFn: () => entryTemplatesApi.list(),
  });

  // Error handling for entries list
  useEffect(() => {
    if (isError) toast.error('Failed to load entries');
  }, [isError]);

  // Error handling for categories dropdown
  useEffect(() => {
    if (catError) toast.error('Failed to load categories');
  }, [catError]);

  // Derived: at least one filter is active
  const hasFilters =
    searchInput.trim().length > 0 ||
    templateFilter !== 'all' ||
    categoryFilter !== 'all';

  function clearFilters() {
    setSearchInput('');
    setTemplateFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setPage(1);
  }

  const entries = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => entriesApi.deleteEntry(id),
    onSuccess: () => {
      toast.success('Entry deleted');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-summary'] });
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
      queryClient.invalidateQueries({ queryKey: ['entries-summary'] });
      setStatusTarget(null);
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Bulk status handler
  async function handleBulkStatus(status: EntryStatus) {
    const ids = [...selectedIds];
    const results = await Promise.allSettled(
      ids.map((id) => entriesApi.updateEntryStatus(id, status))
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const failedIds = ids.filter((_, i) => results[i]?.status === 'rejected');

    if (succeeded > 0) {
      toast.success(`${succeeded} entr${succeeded === 1 ? 'y' : 'ies'} updated`);
    }
    if (failed > 0) {
      toast.error(`${failed} entr${failed === 1 ? 'y' : 'ies'} could not be updated`);
    }

    if (failed === 0) {
      // All succeeded - clear selection and refresh
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-summary'] });
    } else {
      // Partial failure - keep only failed IDs in selection, refresh list
      setSelectedIds(new Set(failedIds));
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-summary'] });
    }
  }

  // Bulk delete handler
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  async function handleBulkDelete() {
    // Capture IDs before any state changes
    const ids = [...selectedIds];
    setBulkDeleteOpen(false);
    setIsBulkDeleting(true);

    try {
      const results = await Promise.allSettled(
        ids.map((id) => entriesApi.deleteEntry(id))
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      const failedIds = ids.filter((_, i) => results[i]?.status === 'rejected');

      if (succeeded > 0) {
        toast.success(`${succeeded} entr${succeeded === 1 ? 'y' : 'ies'} deleted`);
      }
      if (failed > 0) {
        toast.error(`${failed} entr${failed === 1 ? 'y' : 'ies'} could not be deleted`);
      }

      setSelectedIds(failed === 0 ? new Set() : new Set(failedIds));

      queryClient.invalidateQueries({ queryKey: ['entries'] });
      queryClient.invalidateQueries({ queryKey: ['entries-summary'] });
    } finally {
      setIsBulkDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Entries"
        description="Manage and organize encyclopaedia entries"
      >
        <Button variant="outline" onClick={handleImportClick} className="gap-2">
          <Upload size={16} aria-hidden="true" />
          Import
        </Button>
        {/* Hidden file input for import */}
        <input
          ref={importInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelected}
        />
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

      {/* Summary stat cards */}
      <div className="flex items-center gap-4">
        {/* Total entries */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          {summaryQueries[0].isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">
                {summaryQueries[0].isError ? '-' : (summaryQueries[0].data?.meta?.total ?? '-')}
              </p>
              <p className="text-xs text-slate-500">Total entries</p>
            </div>
          )}
        </div>

        {/* Published */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-green-50 p-2 text-green-600">
            <CheckCircle size={18} aria-hidden="true" />
          </div>
          {summaryQueries[1].isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">
                {summaryQueries[1].isError ? '-' : (summaryQueries[1].data?.meta?.total ?? '-')}
              </p>
              <p className="text-xs text-slate-500">Published</p>
            </div>
          )}
        </div>

        {/* Drafts */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
            <FileText size={18} aria-hidden="true" />
          </div>
          {summaryQueries[2].isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">
                {summaryQueries[2].isError ? '-' : (summaryQueries[2].data?.meta?.total ?? '-')}
              </p>
              <p className="text-xs text-slate-500">Drafts</p>
            </div>
          )}
        </div>

        {/* Needs review */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
            <Clock size={18} aria-hidden="true" />
          </div>
          {summaryQueries[3].isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">
                {summaryQueries[3].isError ? '-' : (summaryQueries[3].data?.meta?.total ?? '-')}
              </p>
              <p className="text-xs text-slate-500">Needs review</p>
            </div>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <Tabs
        value={STATUS_TO_TAB[statusFilter]}
        onValueChange={(v) => {
          const status = TAB_TO_STATUS[v];
          if (status !== undefined) {
            setStatusFilter(status);
            setPage(1);
          }
        }}
      >
        <TabsList variant="line">
          <TabsTrigger value="all" variant="line">All entries</TabsTrigger>
          <TabsTrigger value="published" variant="line">Published</TabsTrigger>
          <TabsTrigger value="draft" variant="line">Draft</TabsTrigger>
          <TabsTrigger value="needs-review" variant="line">Needs review</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              placeholder="Search entries..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              maxLength={200}
              className="pl-9"
            />
          </div>

          {/* Template filter */}
          <Select
            value={templateFilter}
            onValueChange={(v) => {
              setTemplateFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {(templatesData ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Category */}
          <Select
            value={categoryFilter}
            disabled={catLoading || catError}
            onValueChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(catData?.data ?? []).map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.translations?.find((t) => t.locale === 'en')?.name ?? cat.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors whitespace-nowrap"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  {(() => {
                    const allOnPageSelected = entries.length > 0 && entries.every(e => selectedIds.has(e.id));
                    const someOnPageSelected = entries.some(e => selectedIds.has(e.id));
                    const headerIndeterminate = someOnPageSelected && !allOnPageSelected;
                    return (
                      <Checkbox
                        checked={allOnPageSelected}
                        indeterminate={headerIndeterminate}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (allOnPageSelected) {
                              entries.forEach(e => next.delete(e.id));
                            } else {
                              entries.forEach(e => next.add(e.id));
                            }
                            return next;
                          });
                        }}
                        aria-label="Select all"
                      />
                    );
                  })()}
                </TableHead>
                <SortableTableHead
                  sortKey="title"
                  currentSort={sortKey}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                >
                  Title
                </SortableTableHead>
                <SortableTableHead
                  sortKey="type"
                  currentSort={sortKey}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                >
                  Type
                </SortableTableHead>
                <TableHead>Category</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <SortableTableHead
                  sortKey="updated"
                  currentSort={sortKey}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                >
                  Updated
                </SortableTableHead>
                <TableHead>Languages</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : isError ? (
                // Empty body - error toast already shown via useEffect
                <></>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
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
                    {/* Checkbox - stop propagation so click doesn't navigate */}
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(entry.id)) next.delete(entry.id);
                            else next.add(entry.id);
                            return next;
                          });
                        }}
                        aria-label={`Select ${entry.term ?? entry.id}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-700 max-w-[220px] truncate">
                      {entry.term ? entry.term : '-'}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {entry.entry_template_name ?? '-'}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {entry.category_name ?? '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {(entry.tags ?? []).slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          >
                            {tag.name}
                          </span>
                        ))}
                        {(entry.tags ?? []).length > 3 && (
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            +{(entry.tags ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap">
                      {formatDate(entry.updated_at)}
                    </TableCell>
                    <TableCell>
                      <LanguageBadges locales={entry.languages ?? []} />
                    </TableCell>
                    {/* Actions - stop propagation so click doesn't navigate */}
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
            <TableFooter className="bg-white border-t border-slate-200">
              <tr>
                <td colSpan={9} className="p-0">
                  <TableFooterBar
                    selectedCount={selectedIds.size}
                    pageSize={pageSize}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                    bulkActions={
                      <div className="flex items-center gap-2">
                        <Select onValueChange={(v) => handleBulkStatus(v as EntryStatus)}>
                          <SelectTrigger className="h-8 w-[160px] text-sm text-slate-500 border-slate-200">
                            <SelectValue placeholder="Set status..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="review">Needs review</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="deprecated">Deprecated</SelectItem>
                          </SelectContent>
                        </Select>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2 px-3 text-sm text-slate-500 border-slate-200">
                              Actions <ChevronDown size={14} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setBulkDeleteOpen(true)}>
                              Delete selected
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    }
                  />
                </td>
              </tr>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
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
        description={
          deleteTarget?.status === 'deprecated'
            ? `"${deleteTarget.term ?? '-'}" is deprecated and will be permanently deleted. This action cannot be undone.`
            : `Are you sure you want to delete "${deleteTarget ? (deleteTarget.term ?? '-') : ''}"? This action cannot be undone.`
        }
        confirmLabel={deleteTarget?.status === 'deprecated' ? 'Delete permanently' : 'Delete'}
        loadingLabel="Deleting..."
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />

      {/* Bulk delete confirm dialog */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => setBulkDeleteOpen(open)}
        title="Delete Selected Entries"
        description={`Are you sure you want to delete ${selectedIds.size} entr${selectedIds.size === 1 ? 'y' : 'ies'}? This action cannot be undone.`}
        confirmLabel="Delete"
        loadingLabel="Deleting..."
        onConfirm={handleBulkDelete}
        loading={isBulkDeleting}
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
