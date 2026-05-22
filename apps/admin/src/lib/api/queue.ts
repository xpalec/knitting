import { apiGetWithMeta, apiPatch } from "./client";
import type { ApiResponse } from "./client";

export type QueueStatus = "pending" | "approved" | "rejected";

export interface QueueEntry {
  id: string;
  type: "entry" | "translation" | "correction";
  status: QueueStatus;
  submitter_email?: string;
  reviewer_note?: string;
  submitted_at: string;
  reviewed_at?: string;
  payload: Record<string, unknown>;
}

export interface QueueTranslation {
  id: string;
  entry_id: string;
  entry_term_en?: string;
  locale: string;
  translated_term?: string;
  definition_preview?: string;
  status: QueueStatus;
  submitter_email?: string;
  submitted_at: string;
  payload: Record<string, unknown>;
}

export interface QueueCorrection {
  id: string;
  entry_id: string;
  entry_term?: string;
  field: string;
  current_value?: string;
  suggested_value?: string;
  note?: string;
  status: "pending" | "acknowledged" | "dismissed";
  submitted_at: string;
}

export interface QueueListParams {
  status?: QueueStatus;
  page?: number;
  limit?: number;
}

export interface ApproveRejectPayload {
  action: "approve" | "reject";
  reviewer_note?: string;
}

export const queueApi = {
  // Entry submissions
  listQueueEntries: (params?: QueueListParams): Promise<ApiResponse<QueueEntry[]>> =>
    apiGetWithMeta<QueueEntry[]>("/api/v1/admin/queue/entries", params as Record<string, unknown>),

  approveQueueEntry: (id: string): Promise<QueueEntry> =>
    apiPatch<QueueEntry>(`/api/v1/admin/queue/entries/${id}`, { action: "approve" }),

  rejectQueueEntry: (id: string, reviewer_note?: string): Promise<QueueEntry> =>
    apiPatch<QueueEntry>(`/api/v1/admin/queue/entries/${id}`, {
      action: "reject",
      reviewer_note,
    }),

  // Translation submissions
  listQueueTranslations: (params?: QueueListParams): Promise<ApiResponse<QueueTranslation[]>> =>
    apiGetWithMeta<QueueTranslation[]>(
      "/api/v1/admin/queue/translations",
      params as Record<string, unknown>,
    ),

  approveQueueTranslation: (id: string): Promise<QueueTranslation> =>
    apiPatch<QueueTranslation>(`/api/v1/admin/queue/translations/${id}`, {
      action: "approve",
    }),

  rejectQueueTranslation: (id: string, reviewer_note?: string): Promise<QueueTranslation> =>
    apiPatch<QueueTranslation>(`/api/v1/admin/queue/translations/${id}`, {
      action: "reject",
      reviewer_note,
    }),

  // Corrections
  listQueueCorrections: (params?: QueueListParams): Promise<ApiResponse<QueueCorrection[]>> =>
    apiGetWithMeta<QueueCorrection[]>(
      "/api/v1/admin/queue/corrections",
      params as Record<string, unknown>,
    ),

  resolveQueueCorrection: (
    id: string,
    action: "acknowledge" | "dismiss",
  ): Promise<QueueCorrection> =>
    apiPatch<QueueCorrection>(`/api/v1/admin/queue/corrections/${id}`, { action }),
};
