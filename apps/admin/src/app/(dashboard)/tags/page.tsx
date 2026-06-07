'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileX,
  Tag,
  Layers,
  Scissors,
  Shirt,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import type { AdminTag, AdminTagListParams, TagType } from '@/lib/api/tags';
import { ApiError } from '@/lib/api/client';

import { TagTypeBadge } from '@/components/tags/tag-type-badge';
import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/ui/pagination';

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
// Summary helper (exported for property testing)
// ---------------------------------------------------------------------------

export interface TagSummary {
  fiber_type: number;
  needle_type: number;
  garment_part: number;
  style_tradition: number;
  total: number;
}

export function computeTagSummary(tags: AdminTag[]): TagSummary {
  const fiber_type      = tags.filter((t) => t.type === 'fiber_type').length;
  const needle_type     = tags.filter((t) => t.type === 'needle_type').length;
  const garment_part    = tags.filter((t) => t.type === 'garment_part').length;
  const style_tradition = tags.filter((t) => t.type === 'style_tradition').length;
  return {
    fiber_type,
    needle_type,
    garment_part,
    style_tradition,
    total: tags.length,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 10;

const TYPE_OPTIONS: { value: TagType | 'all'; label: string }[] = [
  { value: 'all',             label: 'All Types' },
  { value: 'fiber_type',      label: 'Fiber Type' },
  { value: 'needle_type',     label: 'Needle Type' },
  { value: 'garment_part',    label: 'Garment Part' },
  { value: 'style_tradition', label: 'Style Tradition' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTagName(tag: AdminTag): string {
  const translations = tag.translations ?? [];
  return (
    translations.find((t) => t.locale === 'en')?.name ??
    translations[0]?.name ??
    '—'
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
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28 font-mono" /></TableCell>
          <TableCell><Skeleton className="h-5 w-28 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-10" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TagsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TagType | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<AdminTag | null>(null);

  // Debounce search — reset page on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when type filter changes
  useEffect(() => {
    setPage(1);
  }, [typeFilter]);

  // Build query params
  const params: AdminTagListParams = {
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tags', params],
    queryFn: () => adminTagsApi.listTags(params),
  });

  const tags = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Summary query — independent of filters, always fetches all tags
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ['tags-summary'],
    queryFn: () => adminTagsApi.listTags({ limit: 1000 }),
  });

  useEffect(() => {
    if (summaryError) {
      toast.error('Failed to load tag summary');
    }
  }, [summaryError]);

  const summary = summaryData ? computeTagSummary(summaryData.data ?? []) : null;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (slug: string) => adminTagsApi.deleteTag(slug),
    onSuccess: () => {
      toast.success('Tag deleted');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags-summary'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        toast.error('Cannot delete — tag has entries assigned. Remove all assignments first.');
      } else if (err instanceof ApiError && err.status === 403) {
        toast.error('Only admins can delete tags.');
      } else {
        toast.error('Failed to delete tag');
      }
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Tags"
        description="Manage tags for filtering and organizing entries"
      >
        <Button
          variant="outline"
          className="gap-2 border-violet-500 text-violet-600 hover:bg-violet-50 hover:text-violet-700"
        >
          <Search size={16} aria-hidden="true" />
          Filters
        </Button>
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/tags/new">
            <Plus size={16} aria-hidden="true" />
            Add
          </Link>
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {/* Fiber Type */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Scissors size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Fiber</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.fiber_type ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Needle Type */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
              <Tag size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Needle</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.needle_type ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Garment Part */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <Shirt size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Garment</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.garment_part ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Style Tradition */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-50 p-2 text-green-600">
              <Globe size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Style</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.style_tradition ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <Layers size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.total ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
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
                placeholder="Search by slug…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Type filter */}
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as TagType | 'all')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
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
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Color</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : tags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileX size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm font-medium">No tags found</p>
                      <p className="text-xs mt-1">
                        {search || typeFilter !== 'all'
                          ? 'Try adjusting your filters or search query'
                          : 'Create your first tag to get started'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => (
                  <TableRow
                    key={tag.slug}
                    className="cursor-pointer"
                    onClick={() => router.push(`/tags/${tag.slug}`)}
                  >
                    <TableCell className="font-medium text-slate-700 max-w-[200px] truncate">
                      {getTagName(tag)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {tag.slug}
                    </TableCell>
                    <TableCell>
                      <TagTypeBadge type={tag.type} />
                    </TableCell>
                    <TableCell>
                      {tag.color_hex ? (
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-slate-200"
                          style={{ backgroundColor: tag.color_hex }}
                          title={tag.color_hex}
                          aria-label={`Color: ${tag.color_hex}`}
                        />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {tag.entry_count}
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
                            onClick={() => router.push(`/tags/${tag.slug}`)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(tag)}
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
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Tag"
        description={`Are you sure you want to delete "${deleteTarget ? getTagName(deleteTarget) : ''}"? This requires admin role and cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.slug);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
