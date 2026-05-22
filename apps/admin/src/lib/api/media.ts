import { apiGet, apiGetWithMeta, apiUpload, apiDelete } from "./client";
import type { ApiResponse } from "./client";

export type MediaType = "image" | "diagram" | "video";

export interface MediaAsset {
  id: string;
  url: string;
  cdn_url?: string;
  type: MediaType;
  alt_text?: string;
  caption?: string;
  sort_order?: number;
  entry_id?: string;
  entry_term_en?: string;
  created_at: string;
}

export interface ListMediaParams {
  type?: MediaType;
  entry_id?: string;
  page?: number;
  limit?: number;
}

export const mediaApi = {
  listMedia: (params?: ListMediaParams): Promise<ApiResponse<MediaAsset[]>> =>
    apiGetWithMeta<MediaAsset[]>("/api/v1/admin/media", params as Record<string, unknown>),

  getMedia: (id: string): Promise<MediaAsset> =>
    apiGet<MediaAsset>(`/api/v1/admin/media/${id}`),

  uploadMedia: (formData: FormData): Promise<MediaAsset> =>
    apiUpload<MediaAsset>("/api/v1/admin/media/upload", formData),

  deleteMedia: (id: string): Promise<void> =>
    apiDelete(`/api/v1/admin/media/${id}`),
};
