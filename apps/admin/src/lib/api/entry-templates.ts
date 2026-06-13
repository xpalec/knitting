import { apiGet, apiPost, apiPut, apiDelete } from './client';
import { getBlockType } from '@/lib/block-types';

// ---------------------------------------------------------------------------
// Locale constants
// ---------------------------------------------------------------------------

export const SUPPORTED_LOCALES = ['en', 'pl'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  pl: 'Polish',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntryTemplateBlock {
  id: string;
  type: string;
  label?: string;   // user-editable display name, defaults to block type label
  order: number;
  required: boolean;
}

export type TemplateTranslations = Record<string, Record<string, Record<string, string>>>;

export interface EntryTemplate {
  id: string;
  name: string;
  description?: string;
  blocks: EntryTemplateBlock[];
  translations: TemplateTranslations;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryTemplatePayload {
  name: string;
  description?: string;
  blocks?: EntryTemplateBlock[];
  translations?: TemplateTranslations;
}

export interface UpdateEntryTemplatePayload {
  name?: string;
  description?: string;
  blocks?: EntryTemplateBlock[];
  translations?: TemplateTranslations;
}

// ---------------------------------------------------------------------------
// Translation status
// ---------------------------------------------------------------------------

export type TranslationStatus = 'complete' | 'incomplete' | 'missing';

export function deriveTemplateTranslationStatus(
  template: Pick<EntryTemplate, 'blocks' | 'translations'>,
  locale: Locale,
): TranslationStatus {
  if (template.blocks.length === 0) return 'missing';

  const hasAny = template.blocks.some(
    (block) => template.translations[block.id]?.[locale] !== undefined,
  );
  if (!hasAny) return 'missing';

  const allComplete = template.blocks.every((block) => {
    const blockType = getBlockType(block.type);
    if (!blockType) return true; // unknown types don't block completion
    return blockType.translatableFields.every((field) => {
      const val = template.translations[block.id]?.[locale]?.[field.name];
      return typeof val === 'string' && val.trim().length > 0;
    });
  });

  return allComplete ? 'complete' : 'incomplete';
}

// ---------------------------------------------------------------------------
// Translation state helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Ensures a blockId key exists in translations (adds empty object if missing) */
export function initBlockDefaults(
  current: TemplateTranslations,
  blockId: string,
): TemplateTranslations {
  if (current[blockId] !== undefined) return current;
  return { ...current, [blockId]: {} };
}

/** Removes a blockId entirely from translations */
export function removeBlockDefaults(
  current: TemplateTranslations,
  blockId: string,
): TemplateTranslations {
  const { [blockId]: _removed, ...rest } = current;
  return rest;
}

/** Immutably sets translations[blockId][locale][fieldName] = value */
export function setTranslationField(
  current: TemplateTranslations,
  blockId: string,
  locale: string,
  fieldName: string,
  value: string,
): TemplateTranslations {
  return {
    ...current,
    [blockId]: {
      ...(current[blockId] ?? {}),
      [locale]: {
        ...(current[blockId]?.[locale] ?? {}),
        [fieldName]: value,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const entryTemplatesApi = {
  list: (): Promise<EntryTemplate[]> =>
    apiGet<EntryTemplate[]>('/api/v1/admin/entry-templates'),

  getById: (id: string): Promise<EntryTemplate> =>
    apiGet<EntryTemplate>(`/api/v1/admin/entry-templates/${id}`),

  create: (payload: CreateEntryTemplatePayload): Promise<EntryTemplate> =>
    apiPost<EntryTemplate>('/api/v1/admin/entry-templates', payload),

  update: (id: string, payload: UpdateEntryTemplatePayload): Promise<EntryTemplate> =>
    apiPut<EntryTemplate>(`/api/v1/admin/entry-templates/${id}`, payload),

  delete: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/entry-templates/${id}`),

  /**
   * Merge per-locale defaults for all blocks into the template's translations JSON.
   * blockTranslations: { [blockId]: { [fieldName]: string } }
   */
  upsertTranslation: (
    id: string,
    locale: Locale,
    blockTranslations: Record<string, Record<string, string>>,
  ): Promise<EntryTemplate> =>
    apiPut<EntryTemplate>(
      `/api/v1/admin/entry-templates/${id}/translations/${locale}`,
      blockTranslations,
    ),
};
