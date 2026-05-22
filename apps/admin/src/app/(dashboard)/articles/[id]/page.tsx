'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { articlesApi } from '@/lib/api/articles';
import { ArticleForm } from '@/components/articles/article-form';
import type { ArticleFormValues } from '@/components/articles/article-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: article, isLoading, isError, refetch } = useQuery({
    queryKey: ['article', id],
    queryFn: () => articlesApi.getArticle(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: ArticleFormValues) =>
      articlesApi.updateArticle(id, {
        title: values.title,
        slug: values.slug,
        content: values.content || undefined,
        tags: values.tags.length ? values.tags : undefined,
        country: values.country || undefined,
        author: values.author || undefined,
        cover_image_url: values.cover_image_url,
      }),
    onSuccess: () => {
      toast.success('Article saved');
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
    onError: () => {
      toast.error('Failed to save article');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-8 w-64" />
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-slate-600">Failed to load article.</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      <h1 className="text-2xl font-semibold text-slate-800">{article.title}</h1>

      <div className="mx-auto max-w-2xl">
        <ArticleForm
          initialValues={{
            title: article.title,
            slug: article.slug,
            content: article.content ?? '',
            tags: article.tags ?? [],
            country: article.country ?? '',
            author: article.author ?? '',
            cover_image_url: article.cover_image_url,
          }}
          submitLabel="Save Article"
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
          onCancel={() => router.push('/articles')}
        />
      </div>
    </div>
  );
}
