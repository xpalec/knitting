'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tag,
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  FileX,
  Download,
  Upload,
  BookOpen,
  AlignLeft,
  FileText,
  LayoutGrid,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminCategoriesApi } from '@/lib/api/categories';
import type { AdminCategory, AdminCategoryListParams, CategoryType, CategoryStatus } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';

import { CategoryTypeBadge } from '@/components/categories/category-type-badge';
import { CategoryStatusBadge } from '@/components/categories/category-status-badge';

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

export interface CategorySummary {
  entry: number;
  abbreviation: number;
  article: number;
  total: number;
}

export function computeSummary(categories: AdminCategory[]): CategorySummary {
  const entry = categories.filter((c) => c.type === 'entry').length;
  const abbreviation = categories.filter((c) => c.type === 'abbreviation').length;
  const article = categories.filter((c) => c.type === 'article').length;
  return { entry, abbreviation, article, total: entry + abbreviation + article };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const TYPE_OPTIONS: { value: CategoryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'entry', label: 'Entry' },
  { value: 'abbreviation', label: 'Abbreviation' },
  { value: 'article', label: 'Article' },
];

const STATUS_OPTIONS: { value: CategoryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCategoryName(cat: AdminCategory): string {
  const translations = cat.translations ?? [];
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
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CategoryType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CategoryStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  // Ref for hidden file input (Import)
  const importInputRef = useRef<HTMLInputElement>(null);

  // Debounce search — reset page on query change
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter]);

  // Build query params
  const params: AdminCategoryListParams = {
    page,
    limit: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  };

  const { data, isLoading } = useQuery({
    queryKey: ['categories', params],
    queryFn: () => adminCategoriesApi.listCategories(params),
  });

  const categories = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Summary query — independent of filters, always fetches all categories
  const {
    data: summaryData,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery({
    queryKey: ['categories-summary'],
    queryFn: () => adminCategoriesApi.listCategories({ limit: 1000 }),
  });

  // Show toast on summary error (only once per error state)
  useEffect(() => {
    if (summaryError) {
      toast.error('Failed to load category summary');
    }
  }, [summaryError]);

  const summary = summaryData ? computeSummary(summaryData.data ?? []) : null;

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategoriesApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteTarget(null);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 400) {
        toast.error('Cannot delete — category has entries assigned');
      } else {
        toast.error('Failed to delete category');
      }
      setDeleteTarget(null);
    },
  });

  // ---------------------------------------------------------------------------
  // Export handler
  // ---------------------------------------------------------------------------

  async function handleExport() {
    try {
      const exportParams: AdminCategoryListParams = {
        limit: 10000,
        ...(search ? { search } : {}),
        ...(typeFilter !== 'all' ? { type: typeFilter } : {}),
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      };
      const result = await adminCategoriesApi.listCategories(exportParams);
      const rows = result.data ?? [];

      const header = 'id,name,type,status,entry_count,updated_at';
      const csvRows = rows.map((cat) => {
        const name = getCategoryName(cat).replace(/"/g, '""');
        return `${cat.id},"${name}",${cat.type},${cat.status},${cat.entry_count},${cat.updated_at}`;
      });
      const csv = [header, ...csvRows].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'categories.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to export categories');
    }
  }

  // ---------------------------------------------------------------------------
  // Import handler
  // ---------------------------------------------------------------------------

  function handleImportClick() {
    importInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const isCSV = file.name.toLowerCase().endsWith('.csv');

    if (!isCSV || file.size > MAX_SIZE) {
      if (!isCSV) {
        toast.error('Invalid file type. Please select a .csv file.');
      } else {
        toast.error('File is too large. Maximum allowed size is 5 MB.');
      }
      // Reset the input so the same file can be re-selected after fixing
      if (importInputRef.current) importInputRef.current.value = '';
      return;
    }

    // File is valid — actual import API not yet implemented
    toast.success('File ready for import');
    if (importInputRef.current) importInputRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Categories</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={15} aria-hidden="true" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleImportClick}>
            <Upload size={15} aria-hidden="true" />
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
          <Button asChild>
            <Link href="/categories/new">
              <Plus size={16} aria-hidden="true" />
              Add Category
            </Link>
          </Button>
        </div>
      </div>

      {/* Total count */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <div className="rounded-lg bg-slate-50 p-2 text-blue-600">
          <Tag size={18} aria-hidden="true" />
        </div>
        {isLoading ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <span>
            <span className="font-semibold text-slate-800">{total}</span>{' '}
            {total === 1 ? 'Category' : 'Categories'} total
          </span>
        )}
      </div>

      {/* Summary panel */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Entry */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <BookOpen size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Entry</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.entry ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Abbreviation */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <AlignLeft size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Abbreviation</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.abbreviation ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Article */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-50 p-2 text-green-600">
              <FileText size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Article</p>
              {summaryLoading ? (
                <Skeleton className="mt-1 h-6 w-10" />
              ) : (
                <p className="text-xl font-semibold text-slate-800">
                  {summaryError ? '—' : (summary?.article ?? '—')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Total */}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
              <LayoutGrid size={18} aria-hidden="true" />
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
                placeholder="Search categories…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Type filter */}
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as CategoryType | 'all')}
            >
              <SelectTrigger className="w-[160px]">
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

            {/* Status filter */}
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CategoryStatus | 'all')}
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
                <TableHead>Type</TableHead>
                <TableHead>Entry Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <FileX size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm font-medium">No categories found</p>
                      <p className="text-xs mt-1">
                        {search || typeFilter !== 'all' || statusFilter !== 'all'
                          ? 'Try adjusting your filters or search query'
                          : 'Create your first category to get started'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((cat) => (
                  <TableRow
                    key={cat.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/categories/${cat.id}`)}
                  >
                    <TableCell className="font-medium text-slate-700 max-w-[240px] truncate">
                      <span className="flex items-center gap-2">
                        {cat.icon != null && (
                          <span className="text-base leading-none" aria-hidden="true">
                            {cat.icon}
                          </span>
                        )}
                        {getCategoryName(cat)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CategoryTypeBadge type={cat.type} />
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {cat.entry_count}
                    </TableCell>
                    <TableCell>
                      <CategoryStatusBadge status={cat.status} />
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap text-sm">
                      {new Date(cat.updated_at).toLocaleDateString()}
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
                            onClick={() => router.push(`/categories/${cat.id}`)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={() => setDeleteTarget(cat)}
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

      {/* Pagination — always rendered */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Page <span className="font-medium text-slate-700">{page}</span> of{' '}
          <span className="font-medium text-slate-700">{totalPages}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Category"
        description={`Are you sure you want to delete "${deleteTarget ? getCategoryName(deleteTarget) : ''}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
