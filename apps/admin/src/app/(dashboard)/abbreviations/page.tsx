'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CaseSensitive,
  FileX,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { abbreviationsApi } from '@/lib/api/abbreviations';
import type { Abbreviation } from '@/lib/api/abbreviations';
import { ApiError } from '@/lib/api/client';
import { useLanguages } from '@/hooks/useLanguages';

import { PageHeader } from '@/components/layout/page-header';
import { LanguageBadges } from '@/components/ui/language-badges';
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
import { AbbreviationCreateDialog } from '@/components/abbreviations/abbreviation-create-dialog';
import { AbbreviationEditDialog } from '@/components/abbreviations/abbreviation-edit-dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8 text-center" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8 text-center" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AbbreviationsPage() {
  const queryClient = useQueryClient();
  const { allLocales, localeLabels } = useLanguages();

  // ── Filter state ───────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [sourceLangFilter, setSourceLangFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Abbreviation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Abbreviation | null>(null);

  // ── 300 ms debounce on search ──────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when language filter changes
  useEffect(() => {
    setPage(1);
  }, [sourceLangFilter]);

  // ── Query ──────────────────────────────────────────────────────────────────
  const params = {
    page,
    limit: pageSize,
    ...(q ? { q } : {}),
    ...(sourceLangFilter !== 'all' ? { source_language: sourceLangFilter } : {}),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['abbreviations', params],
    queryFn: () => abbreviationsApi.listAbbreviations(params),
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load abbreviations');
  }, [isError]);

  // Summary count — use a separate limit:1 query so we always get the total
  const { data: summaryData } = useQuery({
    queryKey: ['abbreviations-summary'],
    queryFn: () => abbreviationsApi.listAbbreviations({ limit: 1 }),
  });

  const abbreviations = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const totalCount = summaryData?.meta?.total ?? 0;

  // ── Delete mutation ────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => abbreviationsApi.deleteAbbreviation(id),
    onSuccess: () => {
      toast.success('Abbreviation deleted');
      queryClient.invalidateQueries({ queryKey: ['abbreviations'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete abbreviation';
      toast.error(message);
      setDeleteTarget(null);
    },
  });

  // ── Filter helpers ─────────────────────────────────────────────────────────
  const hasFilters = searchInput.trim().length > 0 || sourceLangFilter !== 'all';

  function clearFilters() {
    setSearchInput('');
    setQ('');
    setSourceLangFilter('all');
    setPage(1);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Abbreviations"
        description="Manage knitting abbreviations and their translations across languages"
      >
        <Button
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} aria-hidden="true" />
          New abbreviation
        </Button>
      </PageHeader>

      {/* Stats bar */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <CaseSensitive size={18} aria-hidden="true" />
          </div>
          {isLoading && !summaryData ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">{totalCount}</p>
              <p className="text-xs text-slate-500">Total abbreviations</p>
            </div>
          )}
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="flex items-center gap-3">
        {/* Search input */}
        <div className="relative w-[260px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            placeholder="Search abbreviations…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Source language filter */}
        <Select value={sourceLangFilter} onValueChange={setSourceLangFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All languages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All languages</SelectItem>
            {allLocales.map((locale) => (
              <SelectItem key={locale} value={locale}>
                {localeLabels[locale] ?? locale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
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
                <TableHead>Code</TableHead>
                <TableHead>Source language</TableHead>
                <TableHead className="text-center">Linked entries</TableHead>
                <TableHead className="text-center">Translations</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : abbreviations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileX size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm font-medium">No abbreviations found</p>
                      <p className="text-xs mt-1">
                        {hasFilters
                          ? 'Try adjusting your search or filters, or create a new abbreviation'
                          : 'Create your first abbreviation to get started'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                abbreviations.map((abbr) => (
                  <TableRow
                    key={abbr.id}
                    className="cursor-pointer"
                    onClick={() => setEditTarget(abbr)}
                  >
                    {/* Code */}
                    <TableCell className="font-mono font-medium text-slate-800">
                      {abbr.code}
                    </TableCell>

                    {/* Source language badge */}
                    <TableCell>
                      <LanguageBadges locales={[abbr.source_language]} />
                    </TableCell>

                    {/* Linked entries count */}
                    <TableCell className="text-center text-sm text-slate-600">
                      {abbr.entry_abbreviations?.length ?? 0}
                    </TableCell>

                    {/* Translations count */}
                    <TableCell className="text-center text-sm text-slate-600">
                      {abbr.translations?.length ?? 0}
                    </TableCell>

                    {/* Created date */}
                    <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                      {formatDate(abbr.created_at)}
                    </TableCell>

                    {/* Row actions */}
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
                          <DropdownMenuItem onClick={() => setEditTarget(abbr)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(abbr)}
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

            {!isLoading && abbreviations.length > 0 && (
              <TableFooter className="bg-white border-t border-slate-200">
                <tr>
                  <td colSpan={6} className="p-0">
                    <TableFooterBar
                      selectedCount={0}
                      pageSize={pageSize}
                      onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                    />
                  </td>
                </tr>
              </TableFooter>
            )}
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

      {/* Create dialog */}
      <AbbreviationCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        queryKey={['abbreviations']}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['abbreviations-summary'] });
        }}
      />

      {/* Edit dialog */}
      {editTarget && (
        <AbbreviationEditDialog
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          abbreviation={editTarget}
          queryKey={['abbreviations']}
        />
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Abbreviation"
        description={`Are you sure you want to delete "${deleteTarget?.code ?? ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
