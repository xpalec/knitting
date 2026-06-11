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
} from 'lucide-react';
import { toast } from 'sonner';

import {
  entryTemplatesApi,
  deriveTemplateTranslationStatus,
  SUPPORTED_LOCALES,
} from '@/lib/api/entry-templates';
import type { EntryTemplate } from '@/lib/api/entry-templates';
import { useAuthStore } from '@/store/auth';

import { TranslationStatusBadge } from '@/components/content-blocks/translation-status-badge';
import { PageHeader } from '@/components/layout/page-header';
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

const PAGE_SIZE = 20;

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

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
  const [deleteTarget, setDeleteTarget] = useState<EntryTemplate | null>(null);

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

  const totalCount = templates?.length ?? 0;

  const filtered = (templates ?? []).filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entry Templates"
        description="Manage reusable content block templates for encyclopedia entries"
      >
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/entry-templates/new">+ Add Template</Link>
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
                  <TableHead>Name</TableHead>
                  {SUPPORTED_LOCALES.map((locale) => (
                    <TableHead key={locale}>{locale.toUpperCase()}</TableHead>
                  ))}
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
                    <TableCell colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <FileX size={36} className="mb-3" aria-hidden="true" />
                        <p className="text-sm font-medium">No templates found</p>
                        <Button asChild variant="outline" className="mt-4 gap-1">
                          <Link href="/entry-templates/new">+ Add Template</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((template) => (
                    <TableRow
                      key={template.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/entry-templates/${template.id}`)}
                    >
                      <TableCell className="font-medium text-slate-700">{template.name}</TableCell>
                      {SUPPORTED_LOCALES.map((locale) => (
                        <TableCell key={locale}>
                          <TranslationStatusBadge
                            status={deriveTemplateTranslationStatus(template, locale)}
                          />
                        </TableCell>
                      ))}
                      <TableCell className="text-slate-600 text-sm">{template.blocks.length}</TableCell>
                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                        {new Date(template.updated_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </TableCell>
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
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <TableFooterBar pageSize={PAGE_SIZE} />
                    </TableCell>
                  </TableRow>
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
          pageSize={PAGE_SIZE}
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
    </div>
  );
}
