/**
 * MediaAsset schema.
 *
 * Key design rule: MediaAsset has NO alt_text or caption.
 * Those are locale-specific and live in Translation.blocks[blockId] for each media block.
 * The URL is locale-independent (CDN).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const MediaTypeEnum = z.enum(["image", "diagram", "video_clip", "chart"]);
export type MediaType = z.infer<typeof MediaTypeEnum>;

// ---------------------------------------------------------------------------
// MediaAsset
// ---------------------------------------------------------------------------

export const MediaAssetSchema = z.object({
  id: z.string().uuid(),
  entry_id: z.string().uuid(),
  type: MediaTypeEnum,
  /** CDN URL (Cloudflare R2) — locale-independent. */
  url: z.string().url(),
  /** Used when a media block renders a gallery of multiple assets. */
  sort_order: z.number().int().nonnegative(),
});
export type MediaAsset = z.infer<typeof MediaAssetSchema>;
