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
  Layers,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  entryTemplatesApi,
  deriveTemplateTranslationStatus,
  SUPPORTED_LOCALES,
} from '@/lib/api/entry-templates';
import type { EntryTemplate } from '@/lib/api/entry-templates';
import { useAuthStore } from '@/store/auth';

import { LanguageBadges } from '@/components/ui/language-badges';
import type { LocaleTranslationStatus } from '@/components/ui/language-badges';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Pagination, TableFooterBar } from '@/components/ui/pagination';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

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

function getTemplateStatuses(
  template: EntryTemplate,
): Partial<Record<string, LocaleTranslationStatus>> {
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      deriveTemplateTranslationStatus(template, locale),
    ]),
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
          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><div className="flex gap-1"><Skeleton className="h-6 w-6 rounded-lg" /><Skeleton className="h-6 w-6 rounded-lg" /></div></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
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

export default function EntryTemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') router.replace('/dashboard');
  }, [currentUser, router]);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [deleteTarget, setDeleteTarget] = useState<EntryTemplate | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: templates, isLoading, isError, refetch } = useQuery({
    queryKey: ['entry-templates'],
    queryFn: () => entryTemplatesApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => entryTemplatesApi.delete(id),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['entry-templates'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Failed to delete template');
      setDeleteTarget(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(ids.map((id) => entryTemplatesApi.delete(id)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) throw new Error(`${failed} template(s) could not be deleted`);
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} template(s) deleted`);
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['entry-templates'] });
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to delete some templates');
      setBulkDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ['entry-templates'] });
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
    if (selectedIds.size === pageItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pageItems.map((t) => t.id)));
    }
  }

  const totalCount = templates?.length ?? 0;

  const filtered = (templates ?? []).filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const colSpan = 6;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entry Templates"
        description="Manage reusable content block templates for encyclopedia entries"
      >
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/entry-templates/new">
            <Plus size={16} aria-hidden="true" />
            Add template
          </Link>
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <Layers size={18} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">{totalCount}</p>
              <p className="text-xs text-slate-500">Total Templates</p>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative w-[260px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          placeholder="Search templates…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-sm font-medium mb-4">Failed to load templates.</p>
            <Button variant="outline" onClick={() => { toast.error('Failed to load templates'); refetch(); }}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pageItems.length > 0 && selectedIds.size === pageItems.length}
                      indeterminate={selectedIds.size > 0 && selectedIds.size < pageItems.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Languages</TableHead>
                  <TableHead>Blocks</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SkeletonRows />
                ) : pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <FileX size={36} className="mb-3" aria-hidden="true" />
                        <p className="text-sm font-medium">No templates found</p>
                        <p className="text-xs mt-1">
                          {search ? 'Try adjusting your search' : 'Create your first template to get started'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((template) => (
                    <TableRow
                      key={template.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/entry-templates/${template.id}`)}
                      data-selected={selectedIds.has(template.id) || undefined}
                    >
                      {/* Checkbox */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(template.id)}
                          onChange={() => toggleSelect(template.id)}
                          aria-label={`Select ${template.name}`}
                        />
                      </TableCell>

                      {/* Name */}
                      <TableCell className="font-medium text-slate-700">{template.name}</TableCell>

                      {/* Languages with translation status */}
                      <TableCell>
                        <LanguageBadges
                          locales={[...SUPPORTED_LOCALES]}
                          statuses={getTemplateStatuses(template)}
                        />
                      </TableCell>

                      {/* Blocks */}
                      <TableCell className="text-slate-600 text-sm">{template.blocks.length}</TableCell>

                      {/* Updated */}
                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                        {formatDate(template.updated_at)}
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
                            <DropdownMenuItem onClick={() => router.push(`/entry-templates/${template.id}`)}>
                              <Pencil size={14} aria-hidden="true" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteTarget(template)}
                            >
                              <Trash2 size={14} aria-hidden="true" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {!isLoading && pageItems.length > 0 && (
                <TableFooter className="bg-white border-t border-slate-200">
                  <tr>
                    <td colSpan={colSpan} className="p-0">
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
                                Delete {selectedIds.size} template{selectedIds.size !== 1 ? 's' : ''}
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
      )}

      {!isError && !isLoading && filtered.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Template"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        loading={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.size} template${selectedIds.size !== 1 ? 's' : ''}`}
        description={`Are you sure you want to delete ${selectedIds.size} template${selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedIds.size} template${selectedIds.size !== 1 ? 's' : ''}`}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
        loading={bulkDeleteMutation.isPending}
      />
    </div>
  );
}
