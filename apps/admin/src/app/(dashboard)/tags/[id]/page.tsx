'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import type { AdminTag } from '@/lib/api/tags';
import { ApiError } from '@/lib/api/client';
import { TagForm, SUPPORTED_LOCALES } from '@/components/tags/tag-form';
import type { TagFormValues, LocaleTabState, SupportedLocale } from '@/components/tags/tag-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function mapTagToFormValues(tag: AdminTag): TagFormValues {
  const locales = {} as Record<SupportedLocale, LocaleTabState>;
  for (const locale of SUPPORTED_LOCALES) {
    const t = tag.translations.find((tr) => tr.locale === locale);
    locales[locale] = {
      name: t?.name ?? '',
      slug: t?.slug ?? '',
      slugManuallyEdited: Boolean(t?.slug),
      description: t?.description ?? null,
      seo_title: t?.seo_title ?? '',
      seo_description: t?.seo_description ?? '',
      status: t?.status ?? 'draft',
    };
  }
  return { locales };
}

export default function EditTagPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [slugErrors, setSlugErrors] = useState<Partial<Record<SupportedLocale, string>>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { data: tag, isLoading, error } = useQuery({
    queryKey: ['tag', id],
    queryFn: () => adminTagsApi.getTag(id),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: TagFormValues) => {
      const localesWithNames = SUPPORTED_LOCALES.filter(
        (locale) => values.locales[locale].name.trim(),
      );
      await Promise.all(
        localesWithNames.map((locale) => {
          const tab = values.locales[locale];
          return adminTagsApi.upsertTranslation(id, locale, {
            name: tab.name.trim(),
            slug: tab.slug.trim(),
            ...(tab.description !== undefined ? { description: tab.description } : {}),
            ...(tab.seo_title.trim() ? { seo_title: tab.seo_title.trim() } : {}),
            ...(tab.seo_description.trim() ? { seo_description: tab.seo_description.trim() } : {}),
            status: tab.status,
          });
        }),
      );
    },
    onSuccess: () => {
      toast.success('Tag saved');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      router.push('/tags');
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('A locale slug is already taken — check your slugs');
      } else {
        toast.error('Failed to save tag');
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminTagsApi.deleteTag(id),
    onSuccess: () => {
      toast.success('Tag deleted');
      router.push('/tags');
    },
    onError: (err) => {
      setDeleteDialogOpen(false);
      if (err instanceof ApiError && err.status === 400) {
        toast.error(err.message || 'Cannot delete — tag has entries assigned.');
      } else {
        toast.error('Failed to delete tag');
      }
    },
  });

  function handleSubmit(values: TagFormValues) {
    setSlugErrors({});
    updateMutation.mutate(values);
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="rounded-lg border border-slate-200 p-5 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600 text-lg">Tag not found</p>
        <Button variant="outline" asChild>
          <Link href="/tags"><ArrowLeft size={16} className="mr-1.5" />Back to Tags</Link>
        </Button>
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600">Failed to load tag.</p>
        <Button variant="outline" asChild>
          <Link href="/tags"><ArrowLeft size={16} className="mr-1.5" />Back to Tags</Link>
        </Button>
      </div>
    );
  }

  const pageTitle = tag.translations.find((t) => t.locale === 'en')?.name ?? 'Edit tag';

  return (
    <>
      <div className="p-6">
        <TagForm
          defaultValues={mapTagToFormValues(tag)}
          isSubmitting={updateMutation.isPending}
          slugErrors={slugErrors}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/tags')}
          onDelete={() => setDeleteDialogOpen(true)}
          title={pageTitle}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Tag"
        description={`Are you sure you want to delete "${pageTitle}"? This requires admin role and cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
