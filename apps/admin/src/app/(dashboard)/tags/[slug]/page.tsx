'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import type { AdminTag, TagTranslationStatus, UpsertTagTranslationPayload } from '@/lib/api/tags';
import { ApiError } from '@/lib/api/client';
import { TagForm } from '@/components/tags/tag-form';
import type { TagFormValues } from '@/components/tags/tag-form';
import { TagTranslationDialog } from '@/components/tags/tag-translation-dialog';
import type { TagTranslationDialogProps } from '@/components/tags/tag-translation-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORTED_LOCALES = ['en', 'pl', 'de', 'no', 'fr'] as const;

const TRANSLATION_STATUS_STYLES: Record<TagTranslationStatus, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  reviewed:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  published: 'bg-green-50 text-green-700 border-green-200',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTagToFormValues(tag: AdminTag): Partial<TagFormValues> {
  return {
    slug: tag.slug,
    type: tag.type ?? '',
    color_hex: tag.color_hex ?? '',
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditTagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Translation dialog state ───────────────────────────────────────────────

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLocale, setDialogLocale] = useState<string | null>(null);
  const [dialogInitialValues, setDialogInitialValues] = useState<
    TagTranslationDialogProps['initialValues'] | undefined
  >(undefined);

  // ── Fetch tag ─────────────────────────────────────────────────────────────

  const {
    data: tag,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['tag', slug],
    queryFn: () => adminTagsApi.getTag(slug),
  });

  // ── Update mutation ───────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: (values: TagFormValues) =>
      adminTagsApi.updateTag(slug, {
        type: values.type || null,
        color_hex: values.color_hex || null,
      }),
    onSuccess: () => {
      toast.success('Tag saved');
      queryClient.invalidateQueries({ queryKey: ['tag', slug] });
    },
    onError: () => {
      toast.error('Failed to save tag');
    },
  });

  // ── Delete mutation ───────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => adminTagsApi.deleteTag(slug),
    onSuccess: () => {
      toast.success('Tag deleted');
      router.push('/tags');
    },
    onError: (err) => {
      setDeleteDialogOpen(false);
      if (err instanceof ApiError && err.status === 400) {
        toast.error(err.message || 'Cannot delete — tag has entries assigned. Remove all assignments first.');
      } else {
        toast.error('Failed to delete tag');
      }
    },
  });

  // ── Upsert translation mutation ───────────────────────────────────────────

  const upsertTranslationMutation = useMutation({
    mutationFn: (payload: UpsertTagTranslationPayload) => {
      if (!dialogLocale) throw new Error('No locale selected');
      return adminTagsApi.upsertTranslation(slug, dialogLocale, payload);
    },
    onSuccess: () => {
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tag', slug] });
    },
    onError: () => {
      toast.error('Failed to save translation');
    },
  });

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
        </div>
      </div>
    );
  }

  // ── 404 state ─────────────────────────────────────────────────────────────

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600 text-lg">Tag not found</p>
        <Button variant="outline" asChild>
          <Link href="/tags">
            <ArrowLeft size={16} aria-hidden="true" className="mr-1.5" />
            Back to Tags
          </Link>
        </Button>
      </div>
    );
  }

  // ── Generic error / missing data ──────────────────────────────────────────

  if (!tag) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600">Failed to load tag.</p>
        <Button variant="outline" asChild>
          <Link href="/tags">
            <ArrowLeft size={16} aria-hidden="true" className="mr-1.5" />
            Back to Tags
          </Link>
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const enTranslation = tag.translations.find((t) => t.locale === 'en');
  const pageTitle = enTranslation?.name ?? tag.slug;

  return (
    <>
      <div className="space-y-6">
        {/* Back link + Delete button */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
            <Link href="/tags">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Tags
            </Link>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 size={16} aria-hidden="true" />
            Delete Tag
          </Button>
        </div>

        <h1 className="text-2xl font-semibold text-slate-800">{pageTitle}</h1>

        {/* Main form */}
        <div className="mx-auto max-w-2xl">
          <TagForm
            defaultValues={mapTagToFormValues(tag)}
            slugReadOnly
            submitLabel="Save Tag"
            isSubmitting={updateMutation.isPending}
            onSubmit={(values) => updateMutation.mutate(values)}
            onCancel={() => router.push('/tags')}
          />
        </div>

        {/* Translations section */}
        <div className="mx-auto max-w-2xl space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">Translations</h2>

          {/* Existing translations table */}
          {tag.translations.length > 0 && (
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Locale</th>
                    <th className="px-4 py-2.5 text-left font-medium">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium">Slug</th>
                    <th className="px-4 py-2.5 text-left font-medium">SEO Title</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tag.translations.map((t) => (
                    <tr key={t.locale} className="bg-white">
                      <td className="px-4 py-2.5 font-mono text-xs uppercase text-slate-700">
                        {t.locale}
                      </td>
                      <td className="px-4 py-2.5 text-slate-800">{t.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        {t.slug}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs truncate max-w-[120px]">
                        {t.seo_title ?? '—'}
                      </td>
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
                              seo_title: t.seo_title,
                              seo_description: t.seo_description,
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
            const existingLocales = new Set(tag.translations.map((t) => t.locale));
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
        title="Delete Tag"
        description={`Are you sure you want to delete "${pageTitle}"? This requires admin role and cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {/* Translation dialog */}
      {dialogLocale && (
        <TagTranslationDialog
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
