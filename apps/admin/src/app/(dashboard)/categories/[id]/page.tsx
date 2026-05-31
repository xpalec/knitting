'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { adminCategoriesApi } from '@/lib/api/categories';
import type { AdminCategory, TranslationStatus, UpsertTranslationPayload } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';
import { CategoryForm } from '@/components/categories/category-form';
import type { CategoryFormValues } from '@/components/categories/category-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TranslationDialog } from '@/components/categories/translation-dialog';
import type { TranslationDialogProps } from '@/components/categories/translation-dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_LOCALES = ['en', 'pl', 'de', 'no', 'fr'] as const;

const TRANSLATION_STATUS_STYLES: Record<TranslationStatus, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  reviewed:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  published: 'bg-green-50 text-green-700 border-green-200',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapCategoryToFormValues(category: AdminCategory): CategoryFormValues {
  const enTranslation = category.translations.find((t) => t.locale === 'en');
  return {
    name: enTranslation?.name ?? '',
    slug: enTranslation?.slug ?? '',
    type: category.type,
    icon: category.icon ?? '',
    sort_order: category.sort_order,
    cover_image_url: category.cover_image_url ?? '',
    status: category.status,
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

  const [slugError, setSlugError] = useState<string | undefined>(undefined);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Translation dialog state ───────────────────────────────────────────────

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLocale, setDialogLocale] = useState<string | null>(null);
  const [dialogInitialValues, setDialogInitialValues] = useState<
    TranslationDialogProps['initialValues'] | undefined
  >(undefined);

  // ── Fetch category ────────────────────────────────────────────────────────

  const {
    data: category,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['category', id],
    queryFn: () => adminCategoriesApi.getCategory(id),
  });

  // ── Update mutation ───────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      adminCategoriesApi.updateCategory(id, {
        type: values.type as Exclude<typeof values.type, ''>,
        icon: values.icon || undefined,
        sort_order: values.sort_order,
        status: values.status,
        cover_image_url: values.cover_image_url || null,
      }),
    onSuccess: () => {
      toast.success('Category saved');
      queryClient.invalidateQueries({ queryKey: ['category', id] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setSlugError('This slug is already taken');
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

  // ── Upsert translation mutation ───────────────────────────────────────────

  const upsertTranslationMutation = useMutation({
    mutationFn: (payload: UpsertTranslationPayload) => {
      if (!dialogLocale) throw new Error('No locale selected');
      return adminCategoriesApi.upsertTranslation(id, dialogLocale, payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['category', id] });
    },
    onError: () => {
      toast.error('Failed to save translation');
      // Keep dialog open — do not close
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSubmit(values: CategoryFormValues) {
    setSlugError(undefined);
    updateMutation.mutate(values);
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-8 w-64" />
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
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

  // ── Generic error / missing data ──────────────────────────────────────────

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
  const pageTitle = enTranslation?.name ?? 'Edit Category';

  return (
    <>
      <div className="space-y-6">
        {/* Back link */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
            <Link href="/categories">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Categories
            </Link>
          </Button>

          {/* Delete button */}
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete Category
          </Button>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800">{pageTitle}</h1>

        {/* Main form */}
        <div className="mx-auto max-w-2xl">
          <CategoryForm
            defaultValues={mapCategoryToFormValues(category)}
            submitLabel="Save Category"
            isSubmitting={updateMutation.isPending}
            slugError={slugError}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/categories')}
          />
        </div>

        {/* Translations section */}
        <div className="mx-auto max-w-2xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Translations</h2>

          {/* Existing translations table */}
          {category.translations.length > 0 && (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Locale</th>
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Slug</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {category.translations.map((t) => (
                    <tr key={t.locale} className="bg-white">
                      <td className="px-4 py-2.5 font-mono text-xs uppercase text-slate-700">
                        {t.locale}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800">{t.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{t.slug}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={TRANSLATION_STATUS_STYLES[t.status]}
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-slate-600"
                          onClick={() => {
                            setDialogLocale(t.locale);
                            setDialogInitialValues({
                              name: t.name,
                              slug: t.slug,
                              translator_note: t.translator_note,
                              status: t.status,
                            });
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Translation buttons for missing locales */}
          {(() => {
            const existingLocales = new Set(category.translations.map((t) => t.locale));
            const missingLocales = SUPPORTED_LOCALES.filter((l) => !existingLocales.has(l));
            if (missingLocales.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-2">
                {missingLocales.map((locale) => (
                  <Button
                    key={locale}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setDialogLocale(locale);
                      setDialogInitialValues(undefined);
                      setDialogOpen(true);
                    }}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Add Translation ({locale.toUpperCase()})
                  </Button>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Category"
        description={`Are you sure you want to delete "${pageTitle}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {/* Translation dialog */}
      {dialogLocale && (
        <TranslationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          locale={dialogLocale}
          initialValues={dialogInitialValues}
          onSubmit={(payload) => upsertTranslationMutation.mutate(payload)}
          isSubmitting={upsertTranslationMutation.isPending}
        />
      )}
    </>
  );
}
