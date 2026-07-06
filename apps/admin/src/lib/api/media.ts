import { apiGet, apiGetWithMeta, apiUpload, apiDelete, apiPatch } from "./client";
import type { ApiResponse } from "./client";

export type MediaType = "image" | "diagram" | "video";

export interface MediaAsset {
  id: string;
  source_id: string;
  source_type: "entry" | "article";
  type: MediaType;
  url_original: string;
  url_medium: string | null;
  url_small: string | null;
  alt_text: string | null;
  filename: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ListMediaParams {
  type?: MediaType;
  entry_id?: string;
  page?: number;
  limit?: number;
}

export const mediaApi = {
  // ── Entity-specific upload ──────────────────────────────────────────────────

  /** Upload an image for an entry. Returns the created MediaAsset. */
  uploadForEntry: (entryId: string, formData: FormData): Promise<MediaAsset> =>
    apiUpload<MediaAsset>(`/api/v1/admin/media/entry/${entryId}/upload`, formData),

  /** Upload an image for an article. Returns the created MediaAsset. */
  uploadForArticle: (articleId: string, formData: FormData): Promise<MediaAsset> =>
    apiUpload<MediaAsset>(`/api/v1/admin/media/article/${articleId}/upload`, formData),

  // ── List assets for an entity ───────────────────────────────────────────────

  /** List all media assets associated with a given entity. */
  listForEntity: (sourceType: "entry" | "article", sourceId: string): Promise<MediaAsset[]> =>
    apiGet<MediaAsset[]>(`/api/v1/admin/media/assets`, {
      source_type: sourceType,
      source_id: sourceId,
    }),

  // ── Alt text update ─────────────────────────────────────────────────────────

  /** Update the alt text of an existing media asset. */
  updateAltText: (assetId: string, altText: string | null): Promise<MediaAsset> =>
    apiPatch<MediaAsset>(`/api/v1/admin/media/assets/${assetId}`, {
      alt_text: altText,
    }),

  // ── Legacy methods (kept for backward compatibility) ────────────────────────

  listMedia: (params?: ListMediaParams): Promise<ApiResponse<MediaAsset[]>> =>
    apiGetWithMeta<MediaAsset[]>("/api/v1/admin/media", params as Record<string, unknown>),

  getMedia: (id: string): Promise<MediaAsset> =>
    apiGet<MediaAsset>(`/api/v1/admin/media/${id}`),

  uploadMedia: (formData: FormData): Promise<MediaAsset> =>
    apiUpload<MediaAsset>("/api/v1/admin/media/upload", formData),

  deleteMedia: (id: string): Promise<void> =>
    apiDelete(`/api/v1/admin/media/${id}`),
};
