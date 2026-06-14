'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { articlesApi } from '@/lib/api/articles';
import { useAuthStore } from '@/store/auth';
import { ArticleEditorForm } from '@/components/articles/article-editor-form';
import type { ArticleEditorFormValues } from '@/components/articles/article-editor-form';

export default function NewArticlePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  // Role guard — only admin and editor can create articles
  useEffect(() => {
    if (currentUser && currentUser.role === 'reviewer') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const createMutation = useMutation({
    mutationFn: (values: ArticleEditorFormValues) => {
      const enLocale = values.locales.en;
      return articlesApi.createArticle({
        title: enLocale.title.trim(),
        slug: enLocale.slug.trim(),
        tags: values.tags.length ? values.tags : undefined,
        country: values.country || undefined,
        author: values.author || undefined,
        cover_image_url: values.cover_image_url,
        category_id: values.category_id || undefined,
        status: values.status,
        origin_language: 'en',
      });
    },
    onSuccess: (article) => {
      toast.success('Article created');
      router.push(`/articles/${article.id}`);
    },
    onError: () => {
      toast.error('Failed to create article');
    },
  });

  return (
    <div className="p-6">
      <ArticleEditorForm
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
        onSaveDraft={(values) => createMutation.mutate(values)}
        onCancel={() => router.push('/articles')}
        title="New article"
      />
    </div>
  );
}
