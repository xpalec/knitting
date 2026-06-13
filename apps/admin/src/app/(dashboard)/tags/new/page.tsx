'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import { TagForm, SUPPORTED_LOCALES } from '@/components/tags/tag-form';
import type { TagFormValues, SupportedLocale } from '@/components/tags/tag-form';

export default function NewTagPage() {
  const router = useRouter();
  const [slugErrors, setSlugErrors] = useState<Partial<Record<SupportedLocale, string>>>({});

  const createMutation = useMutation({
    mutationFn: async (values: TagFormValues) => {
      // Step 1: create the tag shell with EN name
      const enLocale = values.locales.en;
      const tag = await adminTagsApi.createTag({
        name_en: enLocale.name.trim(),
        slug_en: enLocale.slug.trim() || undefined,
      });

      // Step 2: upsert all locales (including EN to apply full form data over the seeded row)
      const nonEnLocalesWithNames = SUPPORTED_LOCALES.filter(
        (locale) => locale !== 'en' && values.locales[locale].name.trim(),
      );

      // Always upsert EN to apply description, SEO, status from the form
      const enUpsert = adminTagsApi.upsertTranslation(tag.id, 'en', {
        name: enLocale.name.trim(),
        slug: enLocale.slug.trim() || tag.id,
        ...(enLocale.description ? { description: enLocale.description } : {}),
        ...(enLocale.seo_title.trim() ? { seo_title: enLocale.seo_title.trim() } : {}),
        ...(enLocale.seo_description.trim() ? { seo_description: enLocale.seo_description.trim() } : {}),
        status: enLocale.status,
      });

      await Promise.all([
        enUpsert,
        ...nonEnLocalesWithNames.map((locale) => {
          const tab = values.locales[locale];
          return adminTagsApi.upsertTranslation(tag.id, locale, {
            name: tab.name.trim(),
            slug: tab.slug.trim() || enLocale.slug.trim(),
            ...(tab.description ? { description: tab.description } : {}),
            ...(tab.seo_title.trim() ? { seo_title: tab.seo_title.trim() } : {}),
            ...(tab.seo_description.trim() ? { seo_description: tab.seo_description.trim() } : {}),
            status: tab.status,
          });
        }),
      ]);

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
