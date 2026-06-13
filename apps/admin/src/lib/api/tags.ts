import { apiGet, apiGetWithMeta, apiPost, apiPut, apiDelete } from "./client";
import type { ApiResponse } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TagTranslationStatus = 'draft' | 'reviewed' | 'published';

export interface AdminTagTranslation {
  locale: string;
  name: string;
  slug: string;
  description?: unknown | null;
  seo_title: string | null;
  seo_description: string | null;
  status: TagTranslationStatus;
  updated_at?: string | null;
}

export interface AdminTag {
  id: string;
  translations: AdminTagTranslation[];
  entry_count: number;
  updated_at?: string | null;
}

export interface AdminTagListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateTagPayload {
  name_en: string;
  slug_en?: string;
}

export interface UpdateTagPayload {
  // no language-independent fields remain; kept for API compatibility
}

export interface UpsertTagTranslationPayload {
  name: string;
  slug: string;
  description?: unknown;
  seo_title?: string;
  seo_description?: string;
  status?: TagTranslationStatus;
}

// ─── Admin API client ─────────────────────────────────────────────────────────

export const adminTagsApi = {
  listTags: (params?: AdminTagListParams): Promise<ApiResponse<AdminTag[]>> =>
    apiGetWithMeta<AdminTag[]>('/api/v1/admin/tags', params as Record<string, unknown>),

  getTag: (id: string): Promise<AdminTag> =>
    apiGet<AdminTag>(`/api/v1/admin/tags/${id}`),

  createTag: (dto: CreateTagPayload): Promise<AdminTag> =>
    apiPost<AdminTag>('/api/v1/admin/tags', dto),

  updateTag: (id: string, dto: UpdateTagPayload): Promise<AdminTag> =>
    apiPut<AdminTag>(`/api/v1/admin/tags/${id}`, dto),

  deleteTag: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/tags/${id}`),

  upsertTranslation: (
    id: string,
    locale: string,
    dto: UpsertTagTranslationPayload,
  ): Promise<AdminTagTranslation> =>
    apiPut<AdminTagTranslation>(
      `/api/v1/admin/tags/${id}/translations/${locale}`,
      dto,
    ),
};
