'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { articlesApi, ARTICLE_SUPPORTED_LOCALES } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { ArticleEditorForm } from '@/components/articles/article-editor-form';
import type { ArticleEditorFormValues } from '@/components/articles/article-editor-form';

export default function NewArticlePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);
  // Guard against double-submission (double-click / both buttons)
  const submitted = useRef(false);

  // Role guard — only admin and editor can create articles
  useEffect(() => {
    if (currentUser && currentUser.role === 'reviewer') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const createMutation = useMutation({
    mutationFn: async (values: ArticleEditorFormValues) => {
      // 1. Create the language-independent article record
      const article = await articlesApi.createArticle({
        category_id: values.category_id || null,
        origin_language: 'en',
        cover_image_url: values.cover_image_url ?? null,
        author: values.author || null,
        status: values.status,
      });

      // 2. Save the content_blocks layout manifest
      if (values.blocks.length > 0) {
        await articlesApi.updateBlocks(
          article.id,
          values.blocks.map((b) => ({
            id: b.blockId,
            type: b.type,
            label: b.label,
            order: b.order,
            visible: b.visible,
            required: b.required,
          })),
        );
      }

      // 3. Upsert translations for each locale that has a title
      const localesWithTitle = ARTICLE_SUPPORTED_LOCALES.filter(
        (locale) => values.locales[locale].title.trim(),
      );
      await Promise.all(
        localesWithTitle.map((locale) => {
          const ls = values.locales[locale];
          const blockPayload: Record<string, { heading?: string; content?: unknown }> = {};
          for (const block of values.blocks) {
            const blockLocale = block.locales[locale];
            if (blockLocale) {
              blockPayload[block.blockId] = {
                heading: blockLocale.heading || undefined,
                content: blockLocale.content ?? undefined,
              };
            }
          }
          return articlesApi.upsertTranslation(article.id, locale, {
            title: ls.title.trim(),
            slug: ls.slug.trim(),
            short_description: ls.shortDescription.trim() || undefined,
            seo_title: ls.seoTitle.trim() || undefined,
            seo_description: ls.seoDescription.trim() || undefined,
            blocks: Object.keys(blockPayload).length > 0 ? blockPayload : undefined,
          });
        }),
      );

      // 4. Save tags
      if (values.tags.length > 0) {
        await articlesApi.setTags(article.id, values.tags);
      }

      return article;
    },
    onSuccess: (article) => {
      toast.success('Article created');
      router.push(`/articles/${article.id}`);
    },
    onError: (error) => {
      submitted.current = false;
      const message = error instanceof ApiError ? error.message : 'Failed to create article';
      toast.error(message);
    },
  });

  function handleSubmit(values: ArticleEditorFormValues) {
    if (submitted.current) return;
    submitted.current = true;
    createMutation.mutate(values);
  }

  return (
    <div className="p-6">
      <ArticleEditorForm
        isSubmitting={createMutation.isPending}
        onSubmit={handleSubmit}
        onSaveDraft={handleSubmit}
        onCancel={() => router.push('/articles')}
        title="New article"
      />
    </div>
  );
}
