'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import {
  articlesApi,
} from '@/lib/api/articles';
import type { Article, ArticleLocale, ArticleStatus } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';

import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ArticleEditorForm } from '@/components/articles/article-editor-form';
import type {
  ArticleEditorFormValues,
  ArticleBlockState,
  ArticleLocaleTabState,
} from '@/components/articles/article-editor-form';

// ---------------------------------------------------------------------------
// Helper: map API Article → ArticleEditorFormValues
// ---------------------------------------------------------------------------

let _idSeq = 5000;
function nextId() { return `ae-${_idSeq++}`; }

function mapArticleToFormValues(article: Article): ArticleEditorFormValues {
  const locales: Record<string, ArticleLocaleTabState> = {};

  // Build locale data from all existing translations
  for (const t of (article.translations ?? [])) {
    locales[t.locale] = {
      title: t.title ?? '',
      slug: t.slug ?? '',
      slugManuallyEdited: Boolean(t.slug),
      shortDescription: t.short_description ?? '',
      seoTitle: t.seo_title ?? '',
      seoDescription: t.seo_description ?? '',
    };
  }

  // Map content_blocks layout manifest + per-locale block content from translations
  const blocks: ArticleBlockState[] = (article.content_blocks ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((b) => {
      // Collect per-locale block content from each translation's blocks field
      const localeData: ArticleBlockState['locales'] = {};
      for (const t of (article.translations ?? [])) {
        const blockData = t?.blocks?.[b.id];
        if (blockData) {
          localeData[t.locale as ArticleLocale] = {
            heading: blockData.heading ?? '',
            content: blockData.content ?? null,
          };
        }
      }
      return {
        _id: nextId(),
        blockId: b.id,
        type: b.type,
        label: b.label ?? b.type,
        order: b.order,
        visible: b.visible,
        required: b.required,
        locales: localeData,
      };
    });

  // Tags — we store tag IDs in the form (the editor chips show names via lookup)
  const tags = article.tags?.map((t) => t.id) ?? [];

  return {
    status: article.status ?? 'draft',
    tags,
    author: article.author ?? '',
    cover_image_url: article.cover_image_url ?? undefined,
    category_id: article.category_id ?? '',
    locales,
    blocks,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Role guard
  useEffect(() => {
    if (currentUser && currentUser.role === 'reviewer') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch article
  const { data: article, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['article', id],
    queryFn: () => articlesApi.getArticle(id),
  });

  // Handle 404
  useEffect(() => {
    if (isError && error instanceof ApiError && (error as ApiError).status === 404) {
      toast.error('Article not found');
      router.replace('/articles');
    }
  }, [isError, error, router]);

  // ── Update mutation ──────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (values: ArticleEditorFormValues) => {
      // 1. Update language-independent fields
      await articlesApi.updateArticle(id, {
        category_id: values.category_id || null,
        cover_image_url: values.cover_image_url ?? null,
        author: values.author || null,
        status: values.status as ArticleStatus,
      });

      // 2. Update content_blocks layout manifest
      await articlesApi.updateBlocks(
        id,
        values.blocks.map((b) => ({
          id: b.blockId,
          type: b.type,
          label: b.label,
          order: b.order,
          visible: b.visible,
          required: b.required,
        })),
      );

      // 3. Upsert translations for locales that have a title
      await Promise.all(
        Object.keys(values.locales)
          .filter((locale) => values.locales[locale]?.title?.trim())
          .map((locale) => {
            const ls = values.locales[locale]!;
            const blockPayload: Record<string, { heading?: string; content?: unknown }> = {};
            for (const block of values.blocks) {
              const blockLocale = block.locales[locale as ArticleLocale];
              if (blockLocale) {
                blockPayload[block.blockId] = {
                  heading: blockLocale.heading || undefined,
                  content: blockLocale.content ?? undefined,
                };
              }
            }
            return articlesApi.upsertTranslation(id, locale, {
              title: ls.title.trim(),
              slug: ls.slug.trim(),
              short_description: ls.shortDescription.trim() || undefined,
              seo_title: ls.seoTitle.trim() || undefined,
              seo_description: ls.seoDescription.trim() || undefined,
              blocks: Object.keys(blockPayload).length > 0 ? blockPayload : undefined,
            });
          }),
      );

      // 4. Update tags
      await articlesApi.setTags(id, values.tags);
    },
    onSuccess: () => {
      toast.success('Article saved');
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (error) => {
      const message = error instanceof ApiError ? error.message : 'Failed to save article';
      toast.error(message);
    },
  });

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => articlesApi.deleteArticle(id),
    onSuccess: () => {
      toast.success('Article deleted');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      router.push('/articles');
    },
    onError: (error) => {
      setDeleteDialogOpen(false);
      const message = error instanceof ApiError ? error.message : 'Failed to delete article';
      toast.error(message);
    },
  });

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="flex gap-2 border-b pb-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-20" />)}
            </div>
            <div className="rounded-lg border border-slate-200 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="w-[360px] space-y-3">
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="flex gap-3 border-b pb-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-16" />)}
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
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

  // ── Render ───────────────────────────────────────────────────────────────

  const articleTitle =
    article.translations?.find((t) => t.locale === 'en')?.title ?? 'Edit article';

  return (
    <>
      <div className="p-6">
        <ArticleEditorForm
          defaultValues={mapArticleToFormValues(article)}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
          onSaveDraft={(values) => updateMutation.mutate(values)}
          onCancel={() => router.push('/articles')}
          onDelete={() => setDeleteDialogOpen(true)}
          title={articleTitle}
          articleId={id}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Article"
        description="Are you sure you want to delete this article? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
