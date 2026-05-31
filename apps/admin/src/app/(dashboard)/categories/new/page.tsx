'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { adminCategoriesApi } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';
import { CategoryForm } from '@/components/categories/category-form';
import type { CategoryFormValues } from '@/components/categories/category-form';
import { Button } from '@/components/ui/button';

export default function NewCategoryPage() {
  const router = useRouter();
  const [slugError, setSlugError] = useState<string | undefined>(undefined);

  const createMutation = useMutation({
    mutationFn: (values: CategoryFormValues) =>
      adminCategoriesApi.createCategory({
        type: values.type as Exclude<typeof values.type, ''>,
        name_en: values.name,
        slug_en: values.slug,
        icon: values.icon || undefined,
        sort_order: values.sort_order,
        cover_image_url: values.cover_image_url || undefined,
        status: values.status,
      }),
    onSuccess: (category) => {
      toast.success('Category created');
      router.push(`/categories/${category.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setSlugError('This slug is already taken');
      } else {
        toast.error('Failed to create category');
      }
    },
  });

  function handleSubmit(values: CategoryFormValues) {
    setSlugError(undefined);
    createMutation.mutate(values);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
          <Link href="/categories">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Categories
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold text-slate-800">New Category</h1>

      <div className="mx-auto max-w-2xl">
        <CategoryForm
          submitLabel="Create Category"
          isSubmitting={createMutation.isPending}
          slugError={slugError}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/categories')}
        />
      </div>
    </div>
  );
}
