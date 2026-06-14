import { apiDelete, apiGet, apiGetWithMeta, apiPut, apiPost } from "./client";
import type { ApiResponse } from "./client";

// ---------------------------------------------------------------------------
// Locale constants
// ---------------------------------------------------------------------------

export const ARTICLE_SUPPORTED_LOCALES = ['en', 'pl', 'fr', 'de'] as const;
export type ArticleLocale = (typeof ARTICLE_SUPPORTED_LOCALES)[number];

export const ARTICLE_LOCALE_LABELS: Record<ArticleLocale, string> = {
  en: 'English',
  pl: 'Polish',
  fr: 'French',
  de: 'German',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ArticleStatus = 'draft' | 'review' | 'published' | 'deprecated';
export type ArticleTranslationStatus = 'draft' | 'reviewed' | 'published';

export interface ArticleContentBlock {
  id: string;
  type: string;
  label?: string;
  order: number;
  visible: boolean;
  required: boolean;
}

export interface ArticleTranslation {
  id: string;
  article_id: string;
  locale: string;
  title: string;
  slug: string;
  short_description?: string | null;
  /** Per-block translated content: { [blockId]: { heading?: string; content?: unknown } } */
  blocks: Record<string, { heading?: string; content?: unknown }>;
  seo_title?: string | null;
  seo_description?: string | null;
  translator_note?: string | null;
  status: ArticleTranslationStatus;
  created_at: string;
  updated_at: string;
}

export interface ArticleTag {
  id: string;
  translations: Array<{ locale: string; name: string; slug: string }>;
}

export interface Article {
  id: string;
  category_id: string | null;
  category_name: string | null;
  origin_language: string;
  cover_image_url: string | null;
  author: string | null;
  country_code: string | null;
  content_blocks: ArticleContentBlock[];
  status: ArticleStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  translations: ArticleTranslation[];
  tags: ArticleTag[];
}

// ---------------------------------------------------------------------------
// Request payloads
// ---------------------------------------------------------------------------

export interface CreateArticlePayload {
  category_id?: string | null;
  origin_language?: string;
  cover_image_url?: string | null;
  author?: string | null;
  country_code?: string | null;
  status?: ArticleStatus;
}

export interface UpdateArticlePayload {
  category_id?: string | null;
  cover_image_url?: string | null;
  author?: string | null;
  status?: ArticleStatus;
}

export interface UpsertArticleTranslationPayload {
  title: string;
  slug: string;
  short_description?: string;
  /** Per-block content: { [blockId]: { heading?: string; content?: unknown } } */
  blocks?: Record<string, { heading?: string; content?: unknown }>;
  seo_title?: string;
  seo_description?: string;
  translator_note?: string;
  status?: ArticleTranslationStatus;
}

export interface ListArticlesParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: ArticleStatus;
  locale?: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const articlesApi = {
  listArticles: (params?: ListArticlesParams): Promise<ApiResponse<Article[]>> =>
    apiGetWithMeta<Article[]>("/api/v1/admin/articles", params as Record<string, unknown>),

  getArticle: (id: string): Promise<Article> =>
    apiGet<Article>(`/api/v1/admin/articles/${id}`),

  createArticle: (payload: CreateArticlePayload): Promise<Article> =>
    apiPost<Article>("/api/v1/admin/articles", payload),

  updateArticle: (id: string, payload: UpdateArticlePayload): Promise<Article> =>
    apiPut<Article>(`/api/v1/admin/articles/${id}`, payload),

  updateBlocks: (id: string, blocks: ArticleContentBlock[]): Promise<Article> =>
    apiPut<Article>(`/api/v1/admin/articles/${id}/blocks`, { blocks }),

  upsertTranslation: (
    id: string,
    locale: string,
    payload: UpsertArticleTranslationPayload,
  ): Promise<ArticleTranslation> =>
    apiPut<ArticleTranslation>(`/api/v1/admin/articles/${id}/translations/${locale}`, payload),

  setTags: (id: string, tagIds: string[]): Promise<Article> =>
    apiPut<Article>(`/api/v1/admin/articles/${id}/tags`, { tag_ids: tagIds }),

  deleteArticle: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/articles/${id}`),
};
