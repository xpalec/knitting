'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import { TagForm } from '@/components/tags/tag-form';
import type { TagFormValues } from '@/components/tags/tag-form';

export default function NewTagPage() {
  const router = useRouter();
  const [slugErrors, setSlugErrors] = useState<Partial<Record<string, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (values: TagFormValues) => {
      // Step 1: create the tag shell with default locale name
      const defaultLocale = Object.keys(values.locales).find((l) => values.locales[l]?.name?.trim()) ?? 'en';
      const enLocale = values.locales[defaultLocale] ?? values.locales['en'];
      const tag = await adminTagsApi.createTag({
        name_en: enLocale?.name?.trim() ?? '',
        slug_en: enLocale?.slug?.trim() || undefined,
      });

      // Step 2: upsert all locales that have names (including the default locale to apply full form data)
      const localesWithNames = Object.keys(values.locales).filter(
        (locale) => values.locales[locale]?.name?.trim(),
      );

      await Promise.all(
        localesWithNames.map((locale) => {
          const tab = values.locales[locale]!;
          return adminTagsApi.upsertTranslation(tag.id, locale, {
            name: tab.name.trim(),
            slug: tab.slug.trim() || (enLocale?.slug?.trim() ?? tag.id),
            ...(tab.description ? { description: tab.description } : {}),
            ...(tab.seo_title.trim() ? { seo_title: tab.seo_title.trim() } : {}),
            ...(tab.seo_description.trim() ? { seo_description: tab.seo_description.trim() } : {}),
            status: tab.status,
          });
        }),
      );

      return tag;
    },
    onSuccess: () => {
      toast.success('Tag created');
      router.push('/tags');
    },
    onError: (error) => {
      toast.error('Failed to create tag');
    },
  });

  function handleSubmit(values: TagFormValues) {
    setSlugErrors({});
    createMutation.mutate(values);
  }

  return (
    <div className="p-6">
      <TagForm
        isSubmitting={createMutation.isPending}
        slugErrors={slugErrors}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/tags')}
        title="New tag"
      />
    </div>
  );
}
