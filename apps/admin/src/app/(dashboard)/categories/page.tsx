'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileX,
  Upload,
  BookOpen,
  FileText,
  LayoutGrid,
  CircleFadingPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { adminCategoriesApi } from '@/lib/api/categories';
import type { AdminCategory, AdminCategoryListParams, CategoryType, CategoryStatus } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';
import { colorSlotFromBg } from '@/lib/colors';

import { CategoryTypeBadge } from '@/components/categories/category-type-badge';
import { CategoryStatusBadge } from '@/components/categories/category-status-badge';

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

const DEFAULT_PAGE_SIZE = 10;

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

function getCategoryDescription(cat: AdminCategory): string | null {
  // Return the English slug as a subtitle hint
  const translations = cat.translations ?? [];
  const enTranslation = translations.find((t) => t.locale === 'en');
  if (enTranslation?.slug && enTranslation.slug !== enTranslation.name?.toLowerCase().replace(/\s+/g, '-')) {
    return enTranslation.slug;
  }
  return null;
}

function getParentName(cat: AdminCategory, allCategories: AdminCategory[]): string {
  if (!cat.parent_id) return 'top level';
  const parent = allCategories.find((c) => c.id === cat.parent_id);
  if (!parent) return 'top level';
  return getCategoryName(parent);
}

function getTranslationLocales(cat: AdminCategory): string[] {
  return (cat.translations ?? []).map((t) => t.locale);
}

function formatDateWithAuthor(iso: string | null | undefined): { date: string; author: string } {
  if (!iso) return { date: '—', author: 'Anna Nowak' };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: '—', author: 'Anna Nowak' };
  const date = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return { date, author: 'Anna Nowak' }; // Author field not in API yet — placeholder
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
          <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-5 w-5 rounded-full" /></div></TableCell>
          <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Color dot
// ---------------------------------------------------------------------------

function CategoryColorDot({ color }: { color: string | null }) {
  const slot = colorSlotFromBg(color);
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 rounded-md"
      style={{ backgroundColor: slot.bg }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Sub-category rows (rendered inline below their parent)
// ---------------------------------------------------------------------------

interface SubCategoryRowsProps {
  parentId: string;
  allCategories: AdminCategory[];
  onNavigate: (id: string) => void;
  onDelete: (cat: AdminCategory) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}

function SubCategoryRows({
  parentId,
  allCategories,
  onNavigate,
  onDelete,
  selectedIds,
  onToggleSelect,
}: SubCategoryRowsProps) {
  const children = allCategories.filter((c) => c.parent_id === parentId);

  if (children.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={9}>
          <div className="pl-14 py-2 text-xs text-slate-400 italic">No subcategories</div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {children.map((child) => {
        const { date, author } = formatDateWithAuthor(child.updated_at);
        return (
          <TableRow
            key={child.id}
            className="cursor-pointer bg-slate-50/60 hover:bg-slate-100/60"
            onClick={() => onNavigate(child.id)}
            data-selected={selectedIds.has(child.id) || undefined}
          >
            {/* Checkbox */}
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.has(child.id)}
                onChange={() => onToggleSelect(child.id)}
                aria-label={`Select ${getCategoryName(child)}`}
              />
            </TableCell>

            {/* Title — indented with a left connector */}
            <TableCell className="max-w-[260px]">
              <div className="flex items-center gap-2 pl-7">
                {/* Connector line */}
                <span className="relative flex h-6 w-4 shrink-0">
                  <span className="absolute left-0 top-0 h-full w-px bg-slate-200" />
                  <span className="absolute left-0 top-1/2 h-px w-full bg-slate-200" />
                </span>
                <CategoryColorDot color={child.color} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 truncate text-sm">
                    {getCategoryName(child)}
                  </p>
                  {getCategoryDescription(child) && (
                    <p className="text-xs text-slate-400 truncate">
                      {getCategoryDescription(child)}
                    </p>
                  )}
                </div>
              </div>
            </TableCell>

            {/* Type */}
            <TableCell>
              <CategoryTypeBadge type={child.type} />
            </TableCell>

            {/* Parent — will be the parent name */}
            <TableCell className="text-sm text-slate-500">
              {getCategoryName(allCategories.find((c) => c.id === parentId)!)}
            </TableCell>

            {/* Entries count */}
            <TableCell className="text-sm text-slate-700 font-medium text-center">
              {child.entry_count}
            </TableCell>

            {/* Status */}
            <TableCell>
              <CategoryStatusBadge status={child.status} />
            </TableCell>

            {/* Updated */}
            <TableCell className="whitespace-nowrap">
              <p className="text-sm text-slate-700">{date}</p>
              <p className="text-xs text-slate-400">by {author}</p>
            </TableCell>

            {/* Languages */}
            <TableCell>
              <LanguageBadges locales={getTranslationLocales(child)} />
            </TableCell>

            {/* Actions */}
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
                  <DropdownMenuItem onClick={() => onNavigate(child.id)}>
                    <Pencil size={14} aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-red-600 focus:text-red-600"
                    onClick={() => onDelete(child)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        );
      })}
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
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Active tab — filters the type automatically
  const [activeTab, setActiveTab] = useState<'all' | 'entry' | 'article'>('all');

  // Dialog state
  const [deleteTarget, setDeleteTarget] = useState<AdminCategory | null>(null);

  // Ref for hidden file input (Import)
  const importInputRef = useRef<HTMLInputElement>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  function handleSort(key: string) {
    if (sortKey === key) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortKey(null); setSortDirection(null); }
      else { setSortDirection('asc'); }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  }

  // Expand/collapse state for hierarchical rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Selection helpers
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === topLevelCategories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(topLevelCategories.map((c) => c.id)));
    }
  }

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
  }, [typeFilter, statusFilter, activeTab]);

  // Effective type filter: tab overrides the dropdown when not "all"
  const effectiveType = activeTab !== 'all' ? activeTab : typeFilter;

  // Single query — fetch all categories once, do filtering/pagination client-side.
  // This avoids a second "summary" request just for stats and child lookups.
  const { data: allData, isLoading } = useQuery({
    queryKey: ['categories-all'],
    queryFn: () => adminCategoriesApi.listCategories({ limit: 1000 }),
  });

  const allCats = allData?.data ?? [];

  // Apply active filters to the full list
  const filteredCats = allCats.filter((c) => {
    if (effectiveType !== 'all' && c.type !== effectiveType) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const name = getCategoryName(c).toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  // Stats derived from the full unfiltered list
  const summary = allData ? computeSummary(allCats) : null;

  // Only top-level categories in the main rows
  const topLevelFiltered = filteredCats.filter((c) => c.parent_id === null);

  // Client-side pagination
  const total = topLevelFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const topLevelCategories = topLevelFiltered.slice((page - 1) * pageSize, page * pageSize);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminCategoriesApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['categories-all'] });
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

  // Has active filters?
  const hasFilters = search !== '' || typeFilter !== 'all' || statusFilter !== 'all';

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setActiveTab('all');
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Category"
        description="Manage taxonomy for entries, abbreviations and content"
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
          <Link href="/categories/new">
            <CircleFadingPlus size={16} aria-hidden="true" />
            Add category
          </Link>
        </Button>
      </PageHeader>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'all' | 'entry' | 'article')}
      >
        <TabsList variant="line">
          <TabsTrigger value="all" variant="line">All categories</TabsTrigger>
          <TabsTrigger value="entry" variant="line">Entry categories</TabsTrigger>
          <TabsTrigger value="article" variant="line">Article categories</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary stats — in bordered card boxes */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
            <LayoutGrid size={18} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">{summary?.total ?? '—'}</p>
              <p className="text-xs text-slate-500">Total Categories</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-green-50 p-2 text-green-600">
            <BookOpen size={18} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">{summary?.entry ?? '—'}</p>
              <p className="text-xs text-slate-500">Entry categories</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
          <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
            <FileText size={18} aria-hidden="true" />
          </div>
          {isLoading ? (
            <Skeleton className="h-6 w-12" />
          ) : (
            <div>
              <p className="text-xl font-bold text-slate-800">0</p>
              <p className="text-xs text-slate-500">Empty categories</p>
            </div>
          )}
        </div>
      </div>

      {/* Search & filter bar */}
      <div className="flex items-center justify-between">
        {/* Search — constrained width */}
        <div className="relative w-[260px]">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            placeholder="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>

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
                <TableHead className="w-10">
                  <Checkbox
                    checked={topLevelCategories.length > 0 && selectedIds.size === topLevelCategories.length}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < topLevelCategories.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <SortableTableHead sortKey="name" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>
                  Title
                </SortableTableHead>
                <SortableTableHead sortKey="type" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>
                  Type
                </SortableTableHead>
                <SortableTableHead sortKey="parent" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>
                  Parent
                </SortableTableHead>
                <SortableTableHead sortKey="entries" currentSort={sortKey} currentDirection={sortDirection} onSort={handleSort}>
                  Entries
                </SortableTableHead>
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
              ) : topLevelCategories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9}>
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
                topLevelCategories.map((cat) => {
                  const { date, author } = formatDateWithAuthor(cat.updated_at);
                  const hasChildren = cat.children_count > 0;
                  const isExpanded = expandedIds.has(cat.id);
                  // allCats already available from the single query above

                  return (
                    <React.Fragment key={cat.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => router.push(`/categories/${cat.id}`)}
                        data-selected={selectedIds.has(cat.id) || undefined}
                      >
                        {/* Checkbox */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(cat.id)}
                            onChange={() => toggleSelect(cat.id)}
                            aria-label={`Select ${getCategoryName(cat)}`}
                          />
                        </TableCell>

                        {/* Title with color dot, subtitle & expand toggle */}
                        <TableCell className="max-w-[260px]">
                          <div className="flex items-center gap-2">
                            {hasChildren ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(cat.id); }}
                                className="p-0.5 rounded hover:bg-slate-100 transition-colors shrink-0"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? (
                                  <ChevronUp size={14} className="text-slate-400" />
                                ) : (
                                  <ChevronDown size={14} className="text-slate-400" />
                                )}
                              </button>
                            ) : (
                              <span className="w-5 shrink-0" />
                            )}
                            <CategoryColorDot color={cat.color} />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-700 truncate">
                                {getCategoryName(cat)}
                              </p>
                              {getCategoryDescription(cat) && (
                                <p className="text-xs text-slate-400 truncate">
                                  {getCategoryDescription(cat)}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Type */}
                        <TableCell>
                          <CategoryTypeBadge type={cat.type} />
                        </TableCell>

                        {/* Parent */}
                        <TableCell className="text-sm text-slate-500">
                          {getParentName(cat, allCats)}
                        </TableCell>

                        {/* Entries count */}
                        <TableCell className="text-sm text-slate-700 font-medium text-center">
                          {cat.entry_count}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <CategoryStatusBadge status={cat.status} />
                        </TableCell>

                        {/* Updated */}
                        <TableCell className="whitespace-nowrap">
                          <p className="text-sm text-slate-700">{date}</p>
                          <p className="text-xs text-slate-400">by {author}</p>
                        </TableCell>

                        {/* Languages */}
                        <TableCell>
                          <LanguageBadges locales={getTranslationLocales(cat)} />
                        </TableCell>

                        {/* Actions */}
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

                      {/* Subcategory rows — shown when parent is expanded */}
                      {isExpanded && (
                        <SubCategoryRows
                          parentId={cat.id}
                          allCategories={allCats}
                          onNavigate={(id) => router.push(`/categories/${id}`)}
                          onDelete={setDeleteTarget}
                          selectedIds={selectedIds}
                          onToggleSelect={toggleSelect}
                        />
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
            <TableFooter className="bg-white border-t border-slate-200">
              <tr>
                <td colSpan={9} className="p-0">
                  <TableFooterBar
                    selectedCount={selectedIds.size}
                    pageSize={pageSize}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                  />
                </td>
              </tr>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination — below the card */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
      />

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
