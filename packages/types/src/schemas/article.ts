/**
 * Article schemas — long-form editorial content.
 *
 * Articles use an extended TipTap node schema that includes:
 * - heading (h2/h3 only), paragraph, blockquote, horizontal_rule
 * - bold, italic, underline marks
 * - image (references MediaAsset.id), entry_card (inline entry reference)
 * - ordered_list, bullet_list, list_item
 *
 * Articles are not translated at launch — slug and title are canonical English.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Article status
// ---------------------------------------------------------------------------

export const ArticleStatusEnum = z.enum(["draft", "review", "published"]);
export type ArticleStatus = z.infer<typeof ArticleStatusEnum>;

// ---------------------------------------------------------------------------
// Article TipTap content
// ---------------------------------------------------------------------------

/**
 * TipTap document for articles — extended node set vs. entry definition blocks.
 * Stored as jsonb; validated loosely here since the editor enforces structure.
 */
export const ArticleContentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(z.record(z.string(), z.unknown())),
});
export type ArticleContent = z.infer<typeof ArticleContentSchema>;

// ---------------------------------------------------------------------------
// Article
// ---------------------------------------------------------------------------

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  /** Canonical English slug — immutable once published. */
  slug: z.string().min(1),
  /** Canonical English title. */
  title: z.string().min(1),
  /** TipTap JSON — extended node schema. */
  content: ArticleContentSchema,
  cover_image_url: z.string().url().nullable(),
  author: z.string().min(1),
  /** Country attribution — maps to Entry.origin_language codes. */
  country_code: z.string().nullable(),
  /** Denormalised; computed on save from content length. */
  reading_time_minutes: z.number().int().positive(),
  status: ArticleStatusEnum,
  published_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  /** Tags associated with this article. */
  tags: z.array(z.string()).optional(),
});
export type Article = z.infer<typeof ArticleSchema>;

// ---------------------------------------------------------------------------
// ArticleListItem — card shape for index pages
// ---------------------------------------------------------------------------

export const ArticleListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  cover_image_url: z.string().url().nullable(),
  author: z.string().min(1),
  country_code: z.string().nullable(),
  reading_time_minutes: z.number().int().positive(),
  status: ArticleStatusEnum,
  published_at: z.string().datetime().nullable(),
  tags: z.array(z.string()).optional(),
});
export type ArticleListItem = z.infer<typeof ArticleListItemSchema>;
