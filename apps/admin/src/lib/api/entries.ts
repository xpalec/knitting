import { apiGet, apiGetWithMeta, apiPost, apiPut, apiPatch, apiDelete } from "./client";
import type { ApiResponse } from "./client";
import { adminCategoriesApi } from "./categories";
import type { AdminCategory } from "./categories";

export type EntryStatus = "draft" | "review" | "published" | "deprecated";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";
export type EntryType = "stitch" | "technique" | "tool" | "tradition" | "yarn_weight";

export interface ContentBlock {
  type: string;
  order: number;
  visible: boolean;
  [key: string]: unknown;
}

export interface Translation {
  locale: string;
  term: string;
  slug: string;
  abbreviation?: string;
  definition_short?: string;
  status: "draft" | "reviewed" | "published";
  content_blocks?: ContentBlock[];
}

export interface Entry {
  id: string;
  type: EntryType;
  origin_language: string;
  status: EntryStatus;
  metadata: {
    skill_level?: SkillLevel;
    definition_short?: string;
    [key: string]: unknown;
  };
  // Present on list responses (flat projection from the API)
  term?: string | null;
  slug?: string | null;
  // NEW flat projections (list endpoint only)
  category_id?: string | null;
  category_name?: string | null;
  tags?: Array<{ id: string; name: string }>;
  languages?: string[];
  // Present on single-entry responses
  translations: Translation[];
  content_blocks: ContentBlock[];
  created_at: string;
  updated_at: string;
}

export interface ListEntriesParams {
  locale?: string;
  page?: number;
  limit?: number;
  status?: EntryStatus;
  skillLevel?: SkillLevel;
  originLanguage?: string;
  q?: string;
  // NEW filter params
  type?: EntryType;
  category_id?: string;
}

export interface CreateEntryPayload {
  type: EntryType;
  origin_language: string;
  metadata?: {
    skill_level?: SkillLevel;
    definition_short?: string;
    [key: string]: unknown;
  };
}

export interface UpdateEntryPayload {
  origin_language?: string;
  metadata?: {
    skill_level?: SkillLevel;
    definition_short?: string;
    [key: string]: unknown;
  };
}

export interface UpdateTranslationPayload {
  term?: string;
  slug?: string;
  abbreviation?: string;
  definition_short?: string;
  status?: "draft" | "reviewed" | "published";
  content_blocks?: ContentBlock[];
}

export function listEntryCategories(): Promise<ApiResponse<AdminCategory[]>> {
  return adminCategoriesApi.listCategories({ type: 'entry', limit: 200 });
}

export const entriesApi = {
  listEntries: (params?: ListEntriesParams): Promise<ApiResponse<Entry[]>> =>
    apiGetWithMeta<Entry[]>("/api/v1/admin/entries", params as Record<string, unknown>),

  getEntry: (id: string): Promise<Entry> =>
    apiGet<Entry>(`/api/v1/admin/entries/${id}`),

  createEntry: (payload: CreateEntryPayload): Promise<Entry> =>
    apiPost<Entry>("/api/v1/admin/entries", payload),

  updateEntry: (id: string, payload: UpdateEntryPayload): Promise<Entry> =>
    apiPut<Entry>(`/api/v1/admin/entries/${id}`, payload),

  updateEntryStatus: (id: string, status: EntryStatus): Promise<Entry> =>
    apiPatch<Entry>(`/api/v1/admin/entries/${id}/status`, { status }),

  deleteEntry: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/entries/${id}`),

  updateBlocks: (id: string, blocks: ContentBlock[]): Promise<Entry> =>
    apiPut<Entry>(`/api/v1/admin/entries/${id}/blocks`, { blocks }),

  updateTranslation: (
    id: string,
    locale: string,
    payload: UpdateTranslationPayload,
  ): Promise<Translation> =>
    apiPut<Translation>(
      `/api/v1/admin/entries/${id}/translations/${locale}`,
      payload,
    ),
};
