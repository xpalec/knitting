'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { entriesApi, listEntryCategories } from '@/lib/api/entries';
import { entryTemplatesApi } from '@/lib/api/entry-templates';
import { contentBlockTypesApi } from '@/lib/api/content-block-types';
import { useAuthStore } from '@/store/auth';
import { EntryForm } from '@/components/entries/entry-form';
import type { EntryFormValues } from '@/components/entries/entry-form';

export default function NewEntryPage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  // Role guard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch categories
  const { data: categoriesData, isLoading: isLoadingCategories, error: categoriesError } = useQuery({
    queryKey: ['categories-entry'],
    queryFn: () => listEntryCategories(),
  });

  // Fetch entry templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['entry-templates'],
    queryFn: () => entryTemplatesApi.list(),
  });

  // Fetch content block types (for block editor labels + colors)
  const { data: contentBlockTypes, isLoading: isLoadingContentBlockTypes } = useQuery({
    queryKey: ['content-block-types'],
    queryFn: () => contentBlockTypesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (values: EntryFormValues) => {
      if (!values.entryTemplateId) {
        throw new Error('Please select an entry template before saving.');
      }
      // Find the first locale that has a title (default/en should be first)
      const defaultLocale = Object.keys(values.locales).find(
        (l) => values.locales[l]?.title?.trim()
      ) ?? 'en';
      const defaultLocaleState = values.locales[defaultLocale];
      return entriesApi.createEntry({
        entry_template_id: values.entryTemplateId,
        origin_language: 'en',
        term: defaultLocaleState?.title?.trim() ?? '',
        definition_short: defaultLocaleState?.shortDescription?.trim() || undefined,
        category_id: values.categoryId || undefined,
      });
    },
    onSuccess: (entry) => {
      toast.success('Entry created');
      router.push(`/entries/${entry.id}`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create entry');
    },
  });

  return (
    <div>
      <EntryForm
        categories={categoriesData?.data}
        isLoadingCategories={isLoadingCategories}
        categoriesError={categoriesError}
        templates={templates}
        isLoadingTemplates={isLoadingTemplates}
        contentBlockTypes={contentBlockTypes}
        isLoadingContentBlockTypes={isLoadingContentBlockTypes}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
        onSaveDraft={(values) => createMutation.mutate(values)}
        onCancel={() => router.push('/entries')}
        title="New entry"
      />
    </div>
  );
}
