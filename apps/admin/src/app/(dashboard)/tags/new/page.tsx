'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { adminTagsApi } from '@/lib/api/tags';
import { ApiError } from '@/lib/api/client';
import { TagForm } from '@/components/tags/tag-form';
import type { TagFormValues } from '@/components/tags/tag-form';
import { Button } from '@/components/ui/button';

export default function NewTagPage() {
  const router = useRouter();
  const [slugError, setSlugError] = useState<string | undefined>(undefined);

  const createMutation = useMutation({
    mutationFn: (values: TagFormValues) =>
      adminTagsApi.createTag({
        slug: values.slug,
        name_en: values.name_en,
        slug_en: values.slug, // English translation slug defaults to the canonical slug
        type: values.type || undefined,
        color_hex: values.color_hex || undefined,
      }),
    onSuccess: (tag) => {
      toast.success('Tag created');
      router.push(`/tags/${tag.slug}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setSlugError('This slug is already taken');
      } else {
        toast.error('Failed to create tag');
      }
    },
  });

  function handleSubmit(values: TagFormValues) {
    setSlugError(undefined);
    createMutation.mutate(values);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
          <Link href="/tags">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Tags
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold text-slate-800">New Tag</h1>

      <div className="mx-auto max-w-2xl">
        <TagForm
          submitLabel="Create Tag"
          slugReadOnly={false}
          isSubmitting={createMutation.isPending}
          slugError={slugError}
          onSubmit={handleSubmit}
          onCancel={() => router.push('/tags')}
        />
      </div>
    </div>
  );
}
