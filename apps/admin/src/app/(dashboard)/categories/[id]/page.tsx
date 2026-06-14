'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { adminCategoriesApi } from '@/lib/api/categories';
import type { AdminCategory } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';
import { CategoryForm } from '@/components/categories/category-form';
import type { CategoryFormValues, LocaleTabState } from '@/components/categories/category-form';
import { APP_COLORS } from '@/lib/colors';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Helper — map API category to form default values
// ---------------------------------------------------------------------------

function mapCategoryToFormValues(category: AdminCategory): CategoryFormValues {
  const locales: Record<string, LocaleTabState> = {};

  for (const t of category.translations) {
    locales[t.locale] = {
      name: t.name ?? '',
      slug: t.slug ?? '',
      slugManuallyEdited: Boolean(t.slug),
      short_description: t.short_description ?? '',
      description: t.description ?? null,
      seo_title: t.seo_title ?? '',
      seo_description: t.seo_description ?? '',
      status: t.status ?? 'draft',
    };
  }

  return {
    type: category.type,
    parent_id: category.parent_id,
    color: category.color ?? APP_COLORS.violet.bg,
    status: category.status,
    locales,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [slugErrors, setSlugErrors] = useState<Partial<Record<string, string>>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Fetch category ────────────────────────────────────────────────────────

  const {
    data: category,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['category', id],
    queryFn: () => adminCategoriesApi.getCategory(id),
  });

  // ── Fetch parent categories for the dropdown ──────────────────────────────

  const { data: parentData, isLoading: isLoadingParents, isError: isParentsError } = useQuery({
    queryKey: ['categories-for-parent-select'],
    queryFn: () => adminCategoriesApi.listCategories({ limit: 1000 }),
  });

  useEffect(() => {
    if (isParentsError) toast.error('Failed to load parent categories');
  }, [isParentsError]);

  // Exclude self from parent options
  const parentCategories = (parentData?.data ?? []).filter((c) => c.id !== id);

  // ── Update mutation ───────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      await adminCategoriesApi.updateCategory(id, {
        type: values.type as Exclude<typeof values.type, ''>,
        parent_id: values.parent_id,
        color: values.color || undefined,
        status: values.status,
      });

      const translationPromises = Object.keys(values.locales)
        .filter((locale) => values.locales[locale]?.name?.trim())
        .map((locale) => {
          const tab = values.locales[locale]!;
          return adminCategoriesApi.upsertTranslation(id, locale, {
            name: tab.name.trim(),
            slug: tab.slug.trim(),
            ...(tab.short_description.trim() ? { short_description: tab.short_description.trim() } : {}),
            ...(tab.description ? { description: tab.description } : {}),
            ...(tab.seo_title.trim() ? { seo_title: tab.seo_title.trim() } : {}),
            ...(tab.seo_description.trim() ? { seo_description: tab.seo_description.trim() } : {}),
            status: tab.status,
          });
        });

      await Promise.all(translationPromises);
    },
    onSuccess: () => {
      toast.success('Category saved');
      queryClient.invalidateQueries({ queryKey: ['categories-all'] });
      router.push('/categories');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('A slug is already taken — please check your locale slugs');
      } else {
        toast.error('Failed to save category');
      }
    },
  });

  // ── Delete mutation ───────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => adminCategoriesApi.deleteCategory(id),
    onSuccess: () => {
      toast.success('Category deleted');
      router.push('/categories');
    },
    onError: (err) => {
      setDeleteDialogOpen(false);
      if (err instanceof ApiError && err.status === 400) {
        toast.error(err.message || 'Cannot delete a category that has entries assigned');
      } else {
        toast.error('Failed to delete category');
      }
    },
  });

  function handleSubmit(values: CategoryFormValues) {
    setSlugErrors({});
    updateMutation.mutate(values);
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="rounded-lg border border-slate-200 p-5 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="rounded-lg border border-slate-200 p-5">
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
          <div className="w-[260px] space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 404 state ─────────────────────────────────────────────────────────────

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600 text-lg">Category not found</p>
        <Button variant="outline" asChild>
          <Link href="/categories">
            <ArrowLeft size={16} aria-hidden="true" className="mr-1.5" />
            Back to Categories
          </Link>
        </Button>
      </div>
    );
  }

  // ── Generic error ─────────────────────────────────────────────────────────

  if (!category) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600">Failed to load category.</p>
        <Button variant="outline" asChild>
          <Link href="/categories">
            <ArrowLeft size={16} aria-hidden="true" className="mr-1.5" />
            Back to Categories
          </Link>
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const enTranslation = category.translations.find((t) => t.locale === 'en');
  const pageTitle = enTranslation?.name ?? 'Edit category';

  return (
    <>
      <div className="p-6">
        <CategoryForm
          defaultValues={mapCategoryToFormValues(category)}
          parentCategories={parentCategories}
          isLoadingParents={isLoadingParents}
          isSubmitting={updateMutation.isPending}
          slugErrors={slugErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/categories')}
          onDelete={() => setDeleteDialogOpen(true)}
          title={pageTitle}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Category"
        description={`Are you sure you want to delete "${pageTitle}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
