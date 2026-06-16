import { apiGet, apiGetWithMeta, apiPost, apiPatch, apiDelete } from "./client";
import type { ApiResponse, PaginationParams } from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Abbreviation {
  id: string;
  code: string;
  source_language: string;
  translations: AbbreviationTranslation[];
  entry_abbreviations?: EntryAbbreviation[];
  created_at: string;
  updated_at: string;
}

export interface AbbreviationTranslation {
  id: string;
  abbreviation_id: string;
  locale: string;
  short_meaning: string | null;
  description: unknown | null; // Tiptap JSON
  created_at: string;
  updated_at: string;
}

export interface EntryAbbreviation {
  entry_id: string;
  abbreviation_id: string;
  is_primary: boolean;
  sort_order: number;
}

export interface CreateAbbreviationPayload {
  code: string;
  source_language: string;
}

export interface UpdateAbbreviationPayload {
  code?: string;
  source_language?: string;
}

export interface UpsertAbbreviationTranslationPayload {
  short_meaning?: string | null;
  description?: unknown | null;
}

export interface LinkEntryAbbreviationPayload {
  abbreviation_id: string;
  is_primary?: boolean;
  sort_order?: number;
}

export interface ListAbbreviationsParams extends PaginationParams {
  q?: string;
  source_language?: string;
  display_language?: string;
}

// ─── API client ───────────────────────────────────────────────────────────────

export const abbreviationsApi = {
  listAbbreviations: (params?: ListAbbreviationsParams): Promise<ApiResponse<Abbreviation[]>> =>
    apiGetWithMeta<Abbreviation[]>('/api/v1/admin/abbreviations', params as Record<string, unknown>),

  getAbbreviation: (id: string): Promise<Abbreviation> =>
    apiGet<Abbreviation>(`/api/v1/admin/abbreviations/${id}`),

  createAbbreviation: (payload: CreateAbbreviationPayload): Promise<Abbreviation> =>
    apiPost<Abbreviation>('/api/v1/admin/abbreviations', payload),

  updateAbbreviation: (id: string, payload: UpdateAbbreviationPayload): Promise<Abbreviation> =>
    apiPatch<Abbreviation>(`/api/v1/admin/abbreviations/${id}`, payload),

  deleteAbbreviation: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/abbreviations/${id}`),

  upsertTranslation: (
    id: string,
    locale: string,
    payload: UpsertAbbreviationTranslationPayload,
    exists: boolean,
  ): Promise<AbbreviationTranslation> =>
    exists
      ? apiPatch<AbbreviationTranslation>(
          `/api/v1/admin/abbreviations/${id}/translations/${locale}`,
          payload,
        )
      : apiPost<AbbreviationTranslation>(
          `/api/v1/admin/abbreviations/${id}/translations`,
          { locale, ...payload },
        ),

  deleteTranslation: (id: string, locale: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/abbreviations/${id}/translations/${locale}`),

  linkAbbreviation: (entryId: string, payload: LinkEntryAbbreviationPayload): Promise<EntryAbbreviation> =>
    apiPost<EntryAbbreviation>(`/api/v1/admin/entries/${entryId}/abbreviations`, payload),

  updateLink: (
    entryId: string,
    abbreviationId: string,
    payload: Partial<LinkEntryAbbreviationPayload>,
  ): Promise<EntryAbbreviation> =>
    apiPatch<EntryAbbreviation>(
      `/api/v1/admin/entries/${entryId}/abbreviations/${abbreviationId}`,
      payload,
    ),

  unlinkAbbreviation: (entryId: string, abbreviationId: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/entries/${entryId}/abbreviations/${abbreviationId}`),
};
