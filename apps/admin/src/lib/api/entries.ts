import { apiGet, apiGetWithMeta, apiPost, apiPut, apiPatch, apiDelete } from "./client";
import type { ApiResponse } from "./client";
import { adminCategoriesApi } from "./categories";
import type { AdminCategory } from "./categories";
import type { EntryAbbreviation, Abbreviation } from "./abbreviations";

export type EntryStatus = "draft" | "review" | "published" | "deprecated";
export type TranslationStatus = "draft" | "review" | "ready";
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
  status: TranslationStatus;
  metadata?: Record<string, unknown>;
  // Per-locale content for each block slot, keyed by the block's stable UUID
  blocks?: Record<string, { content?: unknown }>;
}

export interface Entry {
  id: string;
  entry_template_id?: string | null;
  entry_template_name?: string | null;
  // Present on detail responses (findOne)
  entry_template?: {
    id: string;
    name: string;
    blocks: Array<{ id: string; type: string; label?: string; order: number; required: boolean }>;
    translations: Record<string, Record<string, Record<string, string>>>;
  } | null;
  origin_language: string;
  status: EntryStatus;
  metadata: {
    skill_level?: SkillLevel;
    definition_short?: string;
    [key: string]: unknown;
  };
  // Present on list responses
  term?: string | null;
  slug?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  tags?: Array<{ id: string; name: string }>;
  languages?: string[];
  // Present on single-entry responses
  translations: Translation[];
  content_blocks: ContentBlock[];
  // Present on single-entry responses when the backend includes abbreviation links
  entry_abbreviations?: (EntryAbbreviation & { abbreviation: Abbreviation })[];
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
  template_id?: string;
  category_id?: string;
}

export interface CreateEntryPayload {
  entry_template_id: string;
  origin_language: string;
  term: string;
  definition_short?: string;
  category_id?: string;
}

export interface UpdateEntryPayload {
  entry_template_id?: string;
  origin_language?: string;
  category_id?: string;
  metadata?: {
    skill_level?: SkillLevel;
    definition_short?: string;
    [key: string]: unknown;
  };
}

export interface UpdateTranslationPayload {
  term: string;
  slug?: string;
  metadata?: Record<string, unknown>;
  blocks?: Record<string, { content?: unknown }>;
  status?: TranslationStatus;
  translator_note?: string;
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

  /**
   * Replaces the full tag set for an entry.
   * Both linking and unlinking go through this — pass the complete desired set.
   */
  setTags: (entryId: string, tagIds: string[]): Promise<void> =>
    apiPost<void>(`/api/v1/admin/entries/${entryId}/tags`, { ids: tagIds }),
};
