import { apiGet, apiGetWithMeta, apiPost, apiPut, apiDelete } from "./client";
import type { ApiResponse } from "./client";

// ─── Union types ─────────────────────────────────────────────────────────────

export type CategoryType = 'entry' | 'abbreviation' | 'article';
export type CategoryStatus = 'draft' | 'published';
export type TranslationStatus = 'draft' | 'reviewed' | 'published';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AdminCategoryTranslation {
  locale: string;
  name: string;
  slug: string;
  short_description?: string | null;
  description?: unknown; // TipTap JSON
  seo_title?: string | null;
  seo_description?: string | null;
  translator_note?: string;
  status: TranslationStatus;
}

export interface AdminCategory {
  id: string;
  type: CategoryType;
  parent_id: string | null;
  icon: string | null;
  sort_order: number;
  color: string | null;
  status: CategoryStatus;
  entry_count: number;
  cover_image_url: string | null;
  translations: AdminCategoryTranslation[];
  children_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminCategoryListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: CategoryType;
  status?: CategoryStatus;
}

// Language-independent fields only — no name_en or slug_en
export interface CreateCategoryPayload {
  type: CategoryType;
  parent_id?: string | null;
  color?: string;
  status?: CategoryStatus;
}

export interface UpdateCategoryPayload {
  type?: CategoryType;
  parent_id?: string | null;
  color?: string;
  status?: CategoryStatus;
}

export interface UpsertTranslationPayload {
  name: string;
  slug: string;
  short_description?: string;
  description?: unknown; // TipTap JSON
  seo_title?: string;
  seo_description?: string;
  translator_note?: string;
  status?: TranslationStatus;
}

// ─── Admin API client ─────────────────────────────────────────────────────────

export const adminCategoriesApi = {
  listCategories: (params?: AdminCategoryListParams): Promise<ApiResponse<AdminCategory[]>> =>
    apiGetWithMeta<AdminCategory[]>('/api/v1/admin/categories', params as Record<string, unknown>),

  getCategory: (id: string): Promise<AdminCategory> =>
    apiGet<AdminCategory>(`/api/v1/admin/categories/${id}`),

  createCategory: (dto: CreateCategoryPayload): Promise<AdminCategory> =>
    apiPost<AdminCategory>('/api/v1/admin/categories', dto),

  updateCategory: (id: string, dto: UpdateCategoryPayload): Promise<AdminCategory> =>
    apiPut<AdminCategory>(`/api/v1/admin/categories/${id}`, dto),

  deleteCategory: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/categories/${id}`),

  upsertTranslation: (
    id: string,
    locale: string,
    dto: UpsertTranslationPayload,
  ): Promise<AdminCategoryTranslation> =>
    apiPut<AdminCategoryTranslation>(
      `/api/v1/admin/categories/${id}/translations/${locale}`,
      dto,
    ),
};

// ─── Public tree (preserved for backward compatibility) ───────────────────────

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  children?: CategoryNode[];
}

export const categoriesApi = {
  getCategoryTree: (): Promise<CategoryNode[]> =>
    apiGet<CategoryNode[]>("/api/v1/categories/tree"),
};
