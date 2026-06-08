'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  FileX,
  Layers,
  CircleFadingPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  contentBlockTypesApi,
  deriveTranslationStatus,
  SUPPORTED_LOCALES,
} from '@/lib/api/content-block-types';
import type { ContentBlockType } from '@/lib/api/content-block-types';
import { useAuthStore } from '@/store/auth';

import { LanguageBadges } from '@/components/ui/language-badges';
import { BlockTypeBadge } from '@/components/content-blocks/block-type-badge';

import { PageHeader } from '@/components/layout/page-header';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import type { SortDirection } from '@/components/ui/sortable-table-head';
import { Pagination, TableFooterBar } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-40" /></TableCell>
          <TableCell><Skeleton className="h-6 w-20 rounded-lg" /></TableCell>
          <TableCell><div className="flex gap-1"><Skeleton className="h-6 w-6 rounded-lg" /><Skeleton className="h-6 w-6 rounded-lg" /></div></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentBlocksPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);

  // Role guard — redirect non-admin users
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<ContentBlockType | null>(null);

  // Search state — debounced 300ms
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  // Pagination state
  const [page, setPage] = useState(1);

  // Data fetching — single query, all filtering/sorting/pagination client-side
  const {
    data: blockTypes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['content-block-types'],
    queryFn: () => contentBlockTypesApi.list(),
  });

  // Show toast on error
  useEffect(() => {
    if (isError) {
      toast.error('Failed to load block types');
    }
  }, [isError]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => contentBlockTypesApi.delete(id),
    onSuccess: () => {
      toast.success('Block type deleted');
      queryClient.invalidateQueries({ queryKey: ['content-block-types'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Failed to delete block type');
      setDeleteTarget(null);
    },
  });

  // ---------------------------------------------------------------------------
  // Client-side filtering
  // ---------------------------------------------------------------------------

  const filtered = (blockTypes ?? []).filter((bt) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return bt.label.toLowerCase().includes(q) || bt.type.toLowerCase().includes(q);
  });

  // Client-side sorting
  const sorted = [...filtered].sort((a, b) => {
    if (!sortKey || !sortDirection) return 0;
    let aVal = '';
    let bVal = '';
    if (sortKey === 'label') {
      aVal = a.label.toLowerCase();
      bVal = b.label.toLowerCase();
    } else if (sortKey === 'type') {
      aVal = a.type.toLowerCase();
      bVal = b.type.toLowerCase();
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Client-side pagination
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Content Blocks"
        description="Manage content block types and their translations"
      >
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/content-blocks/new">
            <CircleFadingPlus size={16} aria-hidden="true" />
            New Block Type
          </Link>
        </Button>
      </PageHeader>

      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <Layers size={18} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">{blockTypes?.length ?? '—'}</p>
              <p className="text-xs text-slate-500">Block Types</p>
            </div>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="relative w-[260px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            placeholder="Search block types…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Error state */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FileX size={36} className="mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-600">Failed to load block types</p>
          <p className="text-xs mt-1 mb-4">Something went wrong while fetching data.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      sortKey="label"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    >
                      Label
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="type"
                      currentSort={sortKey}
                      currentDirection={sortDirection}
                      onSort={handleSort}
                    >
                      Block Type
                    </SortableTableHead>
                    <TableHead>Languages</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <SkeletonRows />
                  ) : pageItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                          <FileX size={36} className="mb-3" aria-hidden="true" />
                          <p className="text-sm font-medium">No block types found</p>
                          <p className="text-xs mt-1">
                            {search
                              ? 'Try adjusting your search query'
                              : 'Create your first block type to get started'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageItems.map((bt) => (
                      <TableRow
                        key={bt.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/content-blocks/${bt.id}`)}
                      >
                        <TableCell className="font-medium text-slate-700">
                          {bt.label}
                        </TableCell>
                        <TableCell>
                          <BlockTypeBadge type={bt.type} />
                        </TableCell>
                        <TableCell>
                          <LanguageBadges
                            locales={SUPPORTED_LOCALES.filter(
                              (locale) => deriveTranslationStatus(bt, locale) === 'complete'
                            )}
                          />
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
                                onClick={() => router.push(`/content-blocks/${bt.id}`)}
                              >
                                <Pencil size={14} aria-hidden="true" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setDeleteTarget(bt)}
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
                {!isLoading && !isError && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="p-0">
                        <TableFooterBar pageSize={PAGE_SIZE} />
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>

          {/* Pagination below card */}
          {!isLoading && !isError && total > 0 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Block Type"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.label}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </div>
  );
}
