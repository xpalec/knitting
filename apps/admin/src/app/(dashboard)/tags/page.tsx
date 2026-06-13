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
  Tags,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import type { AdminTag, AdminTagListParams } from '@/lib/api/tags';
import { ApiError } from '@/lib/api/client';

import { PageHeader } from '@/components/layout/page-header';
import { LanguageBadges } from '@/components/ui/language-badges';
import { Pagination, TableFooterBar } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-green-50 text-green-700 border-green-200',
  reviewed:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTagName(tag: AdminTag): string {
  return (
    tag.translations.find((t) => t.locale === 'en')?.name ??
    tag.translations[0]?.name ??
    '—'
  );
}

/** EN translation status — representative status for the tag row */
function getEnStatus(tag: AdminTag): string {
  return tag.translations.find((t) => t.locale === 'en')?.status ?? 'draft';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell><Skeleton className="h-4 w-44" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-6 rounded" /><Skeleton className="h-5 w-6 rounded" /></div></TableCell>
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

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<AdminTag | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params: AdminTagListParams = {
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tags', params],
    queryFn: () => adminTagsApi.listTags(params),
  });

  const tags = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminTagsApi.deleteTag(id),
    onSuccess: () => {
      toast.success('Tag deleted');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => adminTagsApi.deleteTag(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) throw new Error(`${failed} tag(s) could not be deleted`);
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} tag(s) deleted`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete some tags');
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === tags.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tags.map((t) => t.id)));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tags"
        description="Manage tags for filtering and organizing entries"
      >
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/tags/new">
            <Plus size={16} aria-hidden="true" />
            Add tag
          </Link>
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <Tags size={18} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">{total}</p>
              <p className="text-xs text-slate-500">Total Tags</p>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-[260px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          placeholder="Search tags..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={tags.length > 0 && selectedIds.size === tags.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < tags.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead>Languages</TableHead>
                <TableHead className="w-12">Actions</TableHead>
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
                        {search ? 'Try adjusting your search' : 'Create your first tag to get started'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                tags.map((tag) => {
                  const enStatus = getEnStatus(tag);
                  const locales = tag.translations.map((t) => t.locale);
                  return (
                    <TableRow
                      key={tag.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/tags/${tag.id}`)}
                      data-selected={selectedIds.has(tag.id) || undefined}
                    >
                      {/* Checkbox */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(tag.id)}
                          onChange={() => toggleSelect(tag.id)}
                          aria-label={`Select ${getTagName(tag)}`}
                        />
                      </TableCell>

                      {/* Name */}
                      <TableCell className="font-medium text-slate-700">
                        {getTagName(tag)}
                      </TableCell>

                      {/* Status — based on EN translation */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[enStatus] ?? STATUS_STYLES.draft}
                        >
                          {enStatus.charAt(0).toUpperCase() + enStatus.slice(1)}
                        </Badge>
                      </TableCell>

                      {/* Updated */}
                      <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                        {formatDate(tag.updated_at)}
                      </TableCell>

                      {/* Languages */}
                      <TableCell>
                        <LanguageBadges locales={locales} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Row actions">
                              <MoreHorizontal size={16} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/tags/${tag.id}`)}>
                              <Pencil size={14} aria-hidden="true" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteTarget(tag)}
                            >
                              <Trash2 size={14} aria-hidden="true" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {!isLoading && tags.length > 0 && (
              <TableFooter className="bg-white border-t border-slate-200">
                <tr>
                  <td colSpan={6} className="p-0">
                    <TableFooterBar
                      selectedCount={selectedIds.size}
                      pageSize={pageSize}
                      onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                      bulkActions={
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 gap-2 px-3 text-sm text-slate-500 border-slate-200">
                              Actions <ChevronDown size={14} aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setBulkDeleteOpen(true)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Delete {selectedIds.size} tag{selectedIds.size !== 1 ? 's' : ''}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      }
                    />
                  </td>
                </tr>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Tag"
        description={`Are you sure you want to delete "${deleteTarget ? getTagName(deleteTarget) : ''}"? This requires admin role and cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.size} tag${selectedIds.size !== 1 ? 's' : ''}`}
        description={`Are you sure you want to delete ${selectedIds.size} tag${selectedIds.size !== 1 ? 's' : ''}? Tags assigned to entries cannot be deleted. This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} tag${selectedIds.size !== 1 ? 's' : ''}`}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
