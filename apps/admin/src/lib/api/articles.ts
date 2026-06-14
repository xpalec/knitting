import { apiDelete, apiGet, apiGetWithMeta, apiPatch, apiPost, apiPut } from "./client";
import type { ApiResponse } from "./client";

// ---------------------------------------------------------------------------
// Locale constants (shared with article-editor-form)
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

export interface ArticleContentBlock {
  id: string;       // stable UUID for the block
  type: string;     // e.g. 'rich_text', 'callout', …
  label?: string;
  order: number;
  visible: boolean;
  required: boolean;
  /** Per-locale heading + TipTap JSON content keyed by locale */
  translations?: Partial<Record<ArticleLocale, { heading?: string; content?: unknown }>>;
}

export interface ArticleTranslation {
  locale: string;
  title: string;
  slug: string;
  short_description?: string;
  seo_title?: string;
  seo_description?: string;
  status: 'draft' | 'reviewed' | 'published';
}

export interface Article {
  id: string;
  // Legacy flat fields (list responses)
  title?: string;
  slug?: string;
  content?: string;
  // New structured fields
  status: ArticleStatus;
  tags?: string[];
  country?: string;
  author?: string;
  cover_image_url?: string;
  category_id?: string;
  category_name?: string;
  translations: ArticleTranslation[];
  content_blocks: ArticleContentBlock[];
  created_at: string;
  updated_at: string;
}

export interface ListArticlesParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: ArticleStatus;
}

export interface CreateArticlePayload {
  /** Origin language / primary locale */
  origin_language?: string;
  title: string;
  slug: string;
  content?: string;
  tags?: string[];
  country?: string;
  author?: string;
  cover_image_url?: string;
  category_id?: string;
  status?: ArticleStatus;
}

export interface UpdateArticlePayload extends Partial<CreateArticlePayload> {}

export interface UpdateArticleTranslationPayload {
  title: string;
  slug?: string;
  short_description?: string;
  seo_title?: string;
  seo_description?: string;
  /** Per-block content keyed by block id: { [blockId]: { heading?, content? } } */
  blocks?: Record<string, { heading?: string; content?: unknown }>;
  status?: 'draft' | 'reviewed' | 'published';
}

export const articlesApi = {
  listArticles: (params?: ListArticlesParams): Promise<ApiResponse<Article[]>> =>
    apiGetWithMeta<Article[]>("/api/v1/articles", params as Record<string, unknown>),

  getArticle: (id: string): Promise<Article> =>
    apiGet<Article>(`/api/v1/articles/${id}`),

  createArticle: (payload: CreateArticlePayload): Promise<Article> =>
    apiPost<Article>("/api/v1/articles", payload),

  updateArticle: (id: string, payload: UpdateArticlePayload): Promise<Article> =>
    apiPut<Article>(`/api/v1/articles/${id}`, payload),

  updateArticleStatus: (id: string, status: ArticleStatus): Promise<Article> =>
    apiPatch<Article>(`/api/v1/articles/${id}/status`, { status }),

  updateTranslation: (
    id: string,
    locale: string,
    payload: UpdateArticleTranslationPayload,
  ): Promise<ArticleTranslation> =>
    apiPut<ArticleTranslation>(`/api/v1/articles/${id}/translations/${locale}`, payload),

  deleteArticle: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/articles/${id}`),
};
