import { apiGet, apiPost, apiPatch, apiDelete } from "./client";
import type { Translation } from "./entries";

// ─── Types ────────────────────────────────────────────────────────────────────

export enum EntryRelationshipType {
  PREREQUISITE = 'PREREQUISITE',
  VARIANT_OF = 'VARIANT_OF',
  ALTERNATIVE_TO = 'ALTERNATIVE_TO',
  COMMONLY_CONFUSED_WITH = 'COMMONLY_CONFUSED_WITH',
  USED_IN = 'USED_IN',
  PART_OF = 'PART_OF',
  COUNTERPART_OF = 'COUNTERPART_OF',
  RELATED_TO = 'RELATED_TO',
}

export interface EntryRelationship {
  id: string;
  sourceEntryId: string;
  targetEntryId: string;
  type: EntryRelationshipType;
  note?: string;
  createdAt: Date;
  /** Included in list responses for display name resolution. */
  targetEntry?: {
    id: string;
    translations: Translation[];
  };
}

export interface CreateRelationshipPayload {
  sourceEntryId: string;
  targetEntryId: string;
  type: EntryRelationshipType;
  note?: string;
}

export interface UpdateRelationshipPayload {
  type?: EntryRelationshipType;
  /** Send empty string to clear the note. */
  note?: string;
}

// ─── Snake-case response shape from the backend ───────────────────────────────

interface EntryRelationshipRaw {
  id: string;
  source_entry_id: string;
  target_entry_id: string;
  type: EntryRelationshipType;
  note?: string;
  created_at: string;
  target_entry?: {
    id: string;
    translations: Translation[];
  };
}

function mapRelationship(raw: EntryRelationshipRaw): EntryRelationship {
  return {
    id: raw.id,
    sourceEntryId: raw.source_entry_id,
    targetEntryId: raw.target_entry_id,
    type: raw.type,
    note: raw.note,
    createdAt: new Date(raw.created_at),
    targetEntry: raw.target_entry,
  };
}

// ─── API client ───────────────────────────────────────────────────────────────

export const entryRelationshipsApi = {
  listRelationships: async (sourceEntryId: string): Promise<EntryRelationship[]> => {
    const raw = await apiGet<EntryRelationshipRaw[]>(
      '/api/v1/admin/entry-relationships',
      { sourceEntryId },
    );
    return raw.map(mapRelationship);
  },

  createRelationship: async (payload: CreateRelationshipPayload): Promise<EntryRelationship> => {
    const raw = await apiPost<EntryRelationshipRaw>(
      '/api/v1/admin/entry-relationships',
      payload,
    );
    return mapRelationship(raw);
  },

  updateRelationship: async (
    id: string,
    payload: UpdateRelationshipPayload,
  ): Promise<EntryRelationship> => {
    const raw = await apiPatch<EntryRelationshipRaw>(
      `/api/v1/admin/entry-relationships/${id}`,
      payload,
    );
    return mapRelationship(raw);
  },

  deleteRelationship: (id: string): Promise<void> =>
    apiDelete<void>(`/api/v1/admin/entry-relationships/${id}`),
};
