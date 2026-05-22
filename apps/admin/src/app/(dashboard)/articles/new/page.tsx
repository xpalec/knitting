'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { articlesApi } from '@/lib/api/articles';
import { ArticleForm } from '@/components/articles/article-form';
import type { ArticleFormValues } from '@/components/articles/article-form';
import { Button } from '@/components/ui/button';

export default function NewArticlePage() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: (values: ArticleFormValues) =>
      articlesApi.createArticle({
        title: values.title,
        slug: values.slug,
        content: values.content || undefined,
        tags: values.tags.length ? values.tags : undefined,
        country: values.country || undefined,
        author: values.author || undefined,
        cover_image_url: values.cover_image_url,
      }),
    onSuccess: (article) => {
      toast.success('Article created');
      router.push(`/articles/${article.id}`);
    },
    onError: () => {
      toast.error('Failed to create article');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
          <Link href="/articles">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Articles
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold text-slate-800">New Article</h1>

      <div className="mx-auto max-w-2xl">
        <ArticleForm
          submitLabel="Create Article"
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
          onCancel={() => router.push('/articles')}
        />
      </div>
    </div>
  );
}
