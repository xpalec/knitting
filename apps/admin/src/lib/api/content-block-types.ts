import { apiDelete, apiGet, apiPost, apiPut } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Locale = "en" | "pl" | "fr" | "de" | "no";
export const SUPPORTED_LOCALES: Locale[] = ["en", "pl", "fr", "de", "no"];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  pl: "Polish",
  fr: "French",
  de: "German",
  no: "Norwegian",
};

/** Fixed list of supported block type slugs shown in the "Block type" dropdown. */
export const BLOCK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "rich_text",   label: "Rich text" },
  { value: "callout",     label: "Callout" },
  { value: "steps",       label: "Steps" },
  { value: "key_facts",   label: "Key facts" },
  { value: "video",       label: "Video" },
  { value: "image",       label: "Image" },
  { value: "relations",   label: "Relations" },
  { value: "pattern",     label: "Pattern usage" },
];

export type TranslationStatus = "complete" | "incomplete" | "missing";

export interface ContentBlockTypeTranslation {
  heading: string;
}

export interface ContentBlockType {
  id: string;
  type: string;
  label: string;
  description?: string;
  color?: string;
  translations: Partial<Record<Locale, ContentBlockTypeTranslation>>;
  created_at: string;
  updated_at: string;
}

export interface CreateContentBlockTypePayload {
  type: string;
  label: string;
  description?: string;
  color?: string;
  translations?: Partial<Record<Locale, ContentBlockTypeTranslation>>;
}

export interface UpdateContentBlockTypePayload {
  label?: string;
  description?: string;
  color?: string;
}

export interface UpsertTranslationPayload {
  heading: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function deriveTranslationStatus(
  blockType: ContentBlockType,
  locale: Locale,
): TranslationStatus {
  const translation = blockType.translations[locale];
  if (!translation) return "missing";
  if (translation.heading && translation.heading.length > 0) return "complete";
  return "incomplete";
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(slug);
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const contentBlockTypesApi = {
  list: (): Promise<ContentBlockType[]> =>
    apiGet<ContentBlockType[]>("/api/v1/admin/content-block-types"),

  getById: (id: string): Promise<ContentBlockType> =>
    apiGet<ContentBlockType>(`/api/v1/admin/content-block-types/${id}`),

  create: (payload: CreateContentBlockTypePayload): Promise<ContentBlockType> =>
    apiPost<ContentBlockType>("/api/v1/admin/content-block-types", payload),

  update: (id: string, payload: UpdateContentBlockTypePayload): Promise<ContentBlockType> =>
    apiPut<ContentBlockType>(`/api/v1/admin/content-block-types/${id}`, payload),

  upsertTranslation: (
    id: string,
    locale: Locale,
    payload: UpsertTranslationPayload,
  ): Promise<ContentBlockType> =>
    apiPut<ContentBlockType>(
      `/api/v1/admin/content-block-types/${id}/translations/${locale}`,
      payload,
    ),

  delete: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/content-block-types/${id}`),
};
