'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { contentBlockTypesApi } from '@/lib/api/content-block-types';
import type { Locale } from '@/lib/api/content-block-types';
import { SUPPORTED_LOCALES } from '@/lib/api/content-block-types';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { ContentBlockForm } from '@/components/content-blocks/content-block-form';
import type { ContentBlockFormValues } from '@/components/content-blocks/content-block-form';

export default function NewContentBlockPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const createMutation = useMutation({
    mutationFn: async (values: ContentBlockFormValues) => {
      // Step 1: create the block type shell
      const blockType = await contentBlockTypesApi.create({
        type: values.type,
        label: values.label,
        color: values.color || undefined,
      });

      // Step 2: upsert translations for all locales that have a heading
      const localesWithHeading = (Object.keys(values.locales) as Locale[]).filter(
        (locale) => values.locales[locale].heading.trim(),
      );

      await Promise.all(
        localesWithHeading.map((locale) =>
          contentBlockTypesApi.upsertTranslation(blockType.id, locale, {
            heading: values.locales[locale].heading.trim(),
          }),
        ),
      );

      return blockType;
    },
    onSuccess: (blockType) => {
      toast.success('Block type created');
      queryClient.invalidateQueries({ queryKey: ['content-block-types'] });
      router.push(`/content-blocks/${blockType.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('A block type with this slug already exists');
      } else {
        toast.error('Failed to create block type');
      }
    },
  });

  return (
    <div className="p-6">
      <ContentBlockForm
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
        onCancel={() => router.push('/content-blocks')}
        title="New content block"
      />
    </div>
  );
}
