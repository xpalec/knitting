'use client';

import { useState, useEffect } from 'react';
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
  MoreHorizontal,
  Pencil,
  Trash2,
  FileX,
} from 'lucide-react';
import { toast } from 'sonner';

import { articlesApi } from '@/lib/api/articles';
import type { Article, ArticleStatus } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';

import { PageHeader } from '@/components/layout/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { LanguageBadges } from '@/components/ui/language-badges';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import type { SortDirection } from '@/components/ui/sortable-table-head';
import { Pagination, TableFooterBar } from '@/components/ui/pagination';
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 10;

const STATUS_TO_TAB: Record<ArticleStatus | 'all', string> = {
  all:        'all',
  published:  'published',
  draft:      'draft',
  review:     'needs-review',
  deprecated: 'deprecated',
};

const TAB_TO_STATUS: Record<string, ArticleStatus | 'all'> = {
  all:           'all',
  published:     'published',
  draft:         'draft',
  'needs-review': 'review',
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ArticleStatus, { bg: string; color: string }> = {
  draft:      { bg: '#F1F5F9', color: '#64748B' },
  review:     { bg: '#FEF9C3', color: '#A16207' },
  published:  { bg: '#EAF6F0', color: '#63A48B' },
  deprecated: { bg: '#FEE2E2', color: '#DC2626' },
};

const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft:      'Draft',
  review:     'In review',
  published:  'Published',
  deprecated: 'Deprecated',
};

function StatusBadge({ status }: { status: ArticleStatus }) {
  const { bg, color } = STATUS_STYLES[status];
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold min-w-[72px] whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {STATUS_LABELS[status]}
    </span>
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
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-12 rounded-full" /><Skeleton className="h-5 w-12 rounded-full" /></div></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-lg" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-5 w-5 rounded-full" /></div></TableCell>
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

function getTitle(article: Article): string {
  return article.translations?.find((t) => t.locale === 'en')?.title ?? '—';
}

function getSlug(article: Article): string {
  return article.translations?.find((t) => t.locale === 'en')?.slug ?? '—';
}

function getTranslationLocales(article: Article): string[] {
  return (article.translations ?? []).map((t) => t.locale);
}

function getTagNames(article: Article): string[] {
  return (article.tags ?? []).map(
    (t) => t.translations?.find((tr) => tr.locale === 'en')?.name ?? t.id,
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArticlesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Article | null>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortKey(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter]);

  // Summary counts — four parallel lightweight queries
  const summaryQueries = useQueries({
    queries: [
      { queryKey: ['articles-summary', 'all'],       queryFn: () => articlesApi.listArticles({ limit: 1 }) },
      { queryKey: ['articles-summary', 'published'], queryFn: () => articlesApi.listArticles({ limit: 1, status: 'published' }) },
      { queryKey: ['articles-summary', 'draft'],     queryFn: () => articlesApi.listArticles({ limit: 1, status: 'draft' }) },
      { queryKey: ['articles-summary', 'review'],    queryFn: () => articlesApi.listArticles({ limit: 1, status: 'review' }) },
    ],
  });

  const params = {
    page,
    limit: pageSize,
    ...(q ? { q } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['articles', params],
    queryFn: () => articlesApi.listArticles(params),
  });

  useEffect(() => {
    if (isError) toast.error('Failed to load articles');
  }, [isError]);

  const articles = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hasFilters = searchInput.trim().length > 0;

  function clearFilters() {
    setSearchInput('');
    setQ('');
    setStatusFilter('all');
    setPage(1);
  }

  // Selection helpers
  const allOnPageSelected = articles.length > 0 && articles.every((a) => selectedIds.has(a.id));
  const someOnPageSelected = articles.some((a) => selectedIds.has(a.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) articles.forEach((a) => next.delete(a.id));
      else articles.forEach((a) => next.add(a.id));
      return next;
    });
  }

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => articlesApi.deleteArticle(id),
    onSuccess: () => {
      toast.success('Article deleted');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['articles-summary'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'Failed to delete article';
      toast.error(message);
      setDeleteTarget(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Articles"
        description="Manage long-form editorial content and tutorials"
      >
        <Button asChild className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Link href="/articles/new">
            <Plus size={16} aria-hidden="true" />
            Add article
          </Link>
        </Button>
      </PageHeader>

      {/* Summary stat cards */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          {summaryQueries[0].isLoading ? <Skeleton className="h-6 w-12" /> : (
            <div>
              <p className="text-xl font-bold text-slate-800">{summaryQueries[0].data?.meta?.total ?? '—'}</p>
              <p className="text-xs text-slate-500">Total articles</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-green-50 p-2 text-green-600">
            <CheckCircle size={18} aria-hidden="true" />
          </div>
          {summaryQueries[1].isLoading ? <Skeleton className="h-6 w-12" /> : (
            <div>
              <p className="text-xl font-bold text-slate-800">{summaryQueries[1].data?.meta?.total ?? '—'}</p>
              <p className="text-xs text-slate-500">Published</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
            <FileText size={18} aria-hidden="true" />
          </div>
          {summaryQueries[2].isLoading ? <Skeleton className="h-6 w-12" /> : (
            <div>
              <p className="text-xl font-bold text-slate-800">{summaryQueries[2].data?.meta?.total ?? '—'}</p>
              <p className="text-xs text-slate-500">Drafts</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
            <Clock size={18} aria-hidden="true" />
          </div>
          {summaryQueries[3].isLoading ? <Skeleton className="h-6 w-12" /> : (
            <div>
              <p className="text-xl font-bold text-slate-800">{summaryQueries[3].data?.meta?.total ?? '—'}</p>
              <p className="text-xs text-slate-500">In review</p>
            </div>
          )}
        </div>
      </div>

      {/* Status tabs */}
      <Tabs
        value={STATUS_TO_TAB[statusFilter]}
        onValueChange={(v) => {
          const status = TAB_TO_STATUS[v];
          if (status !== undefined) setStatusFilter(status);
        }}
      >
        <TabsList variant="line">
          <TabsTrigger value="all" variant="line">All articles</TabsTrigger>
          <TabsTrigger value="published" variant="line">Published</TabsTrigger>
          <TabsTrigger value="draft" variant="line">Draft</TabsTrigger>
          <TabsTrigger value="needs-review" variant="line">In review</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-[260px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            placeholder="Search articles…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={someOnPageSelected && !allOnPageSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <SortableTableHead sortKey="title" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>
                  Title
                </SortableTableHead>
                <TableHead>Author</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <SortableTableHead sortKey="updated" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>
                  Updated
                </SortableTableHead>
                <TableHead>Languages</TableHead>
                <TableHead className="w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : articles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileX size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm font-medium">No articles found</p>
                      <p className="text-xs mt-1">
                        {q ? 'Try a different search query' : 'Create your first article to get started'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                articles.map((article) => {
                  const title = getTitle(article);
                  const slug = getSlug(article);
                  const tagNames = getTagNames(article);
                  const locales = getTranslationLocales(article);

                  return (
                    <TableRow
                      key={article.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/articles/${article.id}`)}
                    >
                      {/* Checkbox */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(article.id)}
                          onChange={() => toggleSelect(article.id)}
                          aria-label={`Select ${title}`}
                        />
                      </TableCell>

                      {/* Title + slug */}
                      <TableCell className="max-w-[280px]">
                        <p className="font-medium text-slate-700 truncate">{title}</p>
                        <p className="text-xs text-slate-400 truncate font-mono">{slug}</p>
                      </TableCell>

                      {/* Author */}
                      <TableCell className="text-sm text-slate-500">
                        {article.author ?? <span className="text-slate-300">—</span>}
                      </TableCell>

                      {/* Tags */}
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {tagNames.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                          {tagNames.length > 3 && (
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                              +{tagNames.length - 3}
                            </span>
                          )}
                          {tagNames.length === 0 && (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <StatusBadge status={article.status} />
                      </TableCell>

                      {/* Updated */}
                      <TableCell className="text-sm text-slate-500 whitespace-nowrap">
                        {formatDate(article.updated_at)}
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
                            <DropdownMenuItem onClick={() => router.push(`/articles/${article.id}`)}>
                              <Pencil size={14} aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteTarget(article)}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>

            {articles.length > 0 && (
              <TableFooter className="bg-white border-t border-slate-200">
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableFooterBar
                      selectedCount={selectedIds.size}
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

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Article"
        description={`Are you sure you want to delete "${deleteTarget ? getTitle(deleteTarget) : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
