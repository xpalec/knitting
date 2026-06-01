import { apiGet, apiGetWithMeta, apiPost, apiPut, apiDelete } from "./client";
import type { ApiResponse } from "./client";

// ─── Union types ─────────────────────────────────────────────────────────────

export type TagType = 'fiber_type' | 'needle_type' | 'garment_part' | 'style_tradition';
export type TagTranslationStatus = 'draft' | 'reviewed' | 'published';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AdminTagTranslation {
  locale: string;
  name: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  status: TagTranslationStatus;
}

export interface AdminTag {
  id: string;
  slug: string; // immutable, used as URL key
  type: TagType | null;
  color_hex: string | null; // #RRGGBB or null
  translations: AdminTagTranslation[];
  entry_count: number;
}

export interface AdminTagListParams {
  page?: number;
  limit?: number;
  search?: string; // slug search only
  type?: TagType;
}

export interface CreateTagPayload {
  slug: string;
  name_en: string;
  slug_en?: string;
  type?: TagType;
  color_hex?: string;
}

export interface UpdateTagPayload {
  type?: TagType | null;
  color_hex?: string | null;
}

export interface UpsertTagTranslationPayload {
  name: string;
  slug: string;
  seo_title?: string;
  seo_description?: string;
  status?: TagTranslationStatus;
}

// ─── Admin API client ─────────────────────────────────────────────────────────

export const adminTagsApi = {
  listTags: (params?: AdminTagListParams): Promise<ApiResponse<AdminTag[]>> =>
    apiGetWithMeta<AdminTag[]>('/api/v1/admin/tags', params as Record<string, unknown>),

  getTag: (slug: string): Promise<AdminTag> =>
    apiGet<AdminTag>(`/api/v1/admin/tags/${slug}`),

  createTag: (dto: CreateTagPayload): Promise<AdminTag> =>
    apiPost<AdminTag>('/api/v1/admin/tags', dto),

  updateTag: (slug: string, dto: UpdateTagPayload): Promise<AdminTag> =>
    apiPut<AdminTag>(`/api/v1/admin/tags/${slug}`, dto),

  deleteTag: (slug: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/tags/${slug}`),

  upsertTranslation: (
    slug: string,
    locale: string,
    dto: UpsertTagTranslationPayload,
  ): Promise<AdminTagTranslation> =>
    apiPut<AdminTagTranslation>(
      `/api/v1/admin/tags/${slug}/translations/${locale}`,
      dto,
    ),
};
