import { apiGet, apiPost, apiPut, apiDelete } from './client';

export interface EntryTemplateBlock {
  type: string;       // Block_Type_Slug (e.g. "rich_text")
  order: number;      // 1-based, contiguous
  required: boolean;
}

export interface EntryTemplate {
  id: string;
  name: string;
  description?: string;
  blocks: EntryTemplateBlock[];
  created_at: string;
  updated_at: string;
}

export interface CreateEntryTemplatePayload {
  name: string;
  description?: string;
  blocks?: EntryTemplateBlock[];
}

export interface UpdateEntryTemplatePayload {
  name?: string;
  description?: string;
  blocks?: EntryTemplateBlock[];
}

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
};
