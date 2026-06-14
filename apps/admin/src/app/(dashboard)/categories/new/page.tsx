'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

import { adminCategoriesApi } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';
import { CategoryForm } from '@/components/categories/category-form';
import type { CategoryFormValues } from '@/components/categories/category-form';

export default function NewCategoryPage() {
  const router = useRouter();
  const [slugErrors, setSlugErrors] = useState<Partial<Record<string, string>>>({});

  // Fetch parent categories for the dropdown
  const { data: parentData, isLoading: isLoadingParents, isError: isParentsError } = useQuery({
    queryKey: ['categories-for-parent-select'],
    queryFn: () => adminCategoriesApi.listCategories({ limit: 1000 }),
  });

  useEffect(() => {
    if (isParentsError) toast.error('Failed to load parent categories');
  }, [isParentsError]);

  const parentCategories = parentData?.data ?? [];

  const createMutation = useMutation({
    mutationFn: async (values: CategoryFormValues) => {
      // Step 1: create category shell (language-independent fields only)
      const category = await adminCategoriesApi.createCategory({
        type: values.type as Exclude<typeof values.type, ''>,
        parent_id: values.parent_id,
        color: values.color || undefined,
        status: values.status,
      });

      // Step 2: upsert translations for all locales that have a name
      const translationPromises = Object.keys(values.locales)
        .filter((locale) => values.locales[locale]?.name?.trim())
        .map((locale) => {
          const tab = values.locales[locale]!;
          return adminCategoriesApi.upsertTranslation(category.id, locale, {
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
      return category;
    },
    onSuccess: (category) => {
      toast.success('Category created');
      router.push(`/categories/${category.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error('A slug is already taken — please check your locale slugs');
      } else {
        toast.error('Failed to create category');
      }
    },
  });

  function handleSubmit(values: CategoryFormValues) {
    setSlugErrors({});
    createMutation.mutate(values);
  }

  return (
    <div className="p-6">
      <CategoryForm
        parentCategories={parentCategories}
        isLoadingParents={isLoadingParents}
        isSubmitting={createMutation.isPending}
        slugErrors={slugErrors}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/categories')}
        title="New category"
      />
    </div>
  );
}
