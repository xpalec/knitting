import { apiDelete, apiGet, apiGetWithMeta, apiPost, apiPut } from "./client";
import type { ApiResponse } from "./client";

export interface Article {
  id: string;
  title: string;
  slug: string;
  content?: string;
  tags?: string[];
  country?: string;
  author?: string;
  cover_image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ListArticlesParams {
  page?: number;
  limit?: number;
  q?: string;
}

export interface CreateArticlePayload {
  title: string;
  slug: string;
  content?: string;
  tags?: string[];
  country?: string;
  author?: string;
  cover_image_url?: string;
}

export interface UpdateArticlePayload extends Partial<CreateArticlePayload> {}

export const articlesApi = {
  listArticles: (params?: ListArticlesParams): Promise<ApiResponse<Article[]>> =>
    apiGetWithMeta<Article[]>("/api/v1/articles", params as Record<string, unknown>),

  getArticle: (id: string): Promise<Article> =>
    apiGet<Article>(`/api/v1/articles/${id}`),

  createArticle: (payload: CreateArticlePayload): Promise<Article> =>
    apiPost<Article>("/api/v1/articles", payload),

  updateArticle: (id: string, payload: UpdateArticlePayload): Promise<Article> =>
    apiPut<Article>(`/api/v1/articles/${id}`, payload),

  deleteArticle: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/articles/${id}`),
};
