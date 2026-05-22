import { apiGet, apiPut } from "./client";
import type { EntryType } from "./entries";

export interface BlockTemplateItem {
  type: string;
  order: number;
  visible: boolean;
  [key: string]: unknown;
}

export interface BlockTemplate {
  entry_type: EntryType;
  blocks: BlockTemplateItem[];
  block_count: number;
  updated_at: string;
}

export const templatesApi = {
  listTemplates: (): Promise<BlockTemplate[]> =>
    apiGet<BlockTemplate[]>("/api/v1/admin/settings/templates"),

  updateTemplate: (
    entryType: EntryType,
    blocks: BlockTemplateItem[],
  ): Promise<BlockTemplate> =>
    apiPut<BlockTemplate>(`/api/v1/admin/settings/templates/${entryType}`, {
      blocks,
    }),
};
