/**
 * Category schemas — hierarchical taxonomy for encyclopedia entries.
 *
 * Categories support unlimited depth via parent_id self-join.
 * 2–3 levels recommended in practice.
 *
 * Display names, slugs, and descriptions live in CategoryTranslation rows —
 * one per locale per category. Mirrors the Entry / Translation pattern.
 */

import { z } from "zod";
import { TranslationStatusEnum } from "./translation.js";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const CategoryStatusEnum = z.enum(["draft", "published"]);
export type CategoryStatus = z.infer<typeof CategoryStatusEnum>;

// ---------------------------------------------------------------------------
// CategoryTranslation
// ---------------------------------------------------------------------------

export const CategoryTranslationSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  /** BCP-47 locale code: en, pl, de, no, fr */
  locale: z.string().min(2),
  /** Locale-specific public URL slug, e.g. "sciegi" (pl), "stitches" (en) */
  slug: z.string().min(1),
  /** Display name in this locale */
  name: z.string().min(1),
  /** TipTap JSON — editorial introduction. Nullable. */
  description: z.unknown().nullable(),
  status: TranslationStatusEnum,
  translator_note: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type CategoryTranslation = z.infer<typeof CategoryTranslationSchema>;

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const CategorySchema = z.object({
  id: z.string().uuid(),
  /** Null for top-level categories. */
  parent_id: z.string().uuid().nullable(),
  /** Icon key or SVG path for UI rendering. */
  icon: z.string().nullable(),
  /** Display ordering within parent. Lower = earlier. */
  sort_order: z.number().int().nonnegative(),
  status: CategoryStatusEnum,
  /** Denormalised count of published entries in this category (direct, not recursive). */
  entry_count: z.number().int().nonnegative(),
  /** Optional CDN URL for richer category landing pages. */
  cover_image_url: z.string().url().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type Category = z.infer<typeof CategorySchema>;

// ---------------------------------------------------------------------------
// CategoryTree — nested structure for the full category tree API response
// ---------------------------------------------------------------------------

/**
 * Recursive category tree node as returned by GET /api/v1/categories.
 * Includes the resolved translation for the requested locale (falls back to 'en').
 */
export type CategoryTree = z.infer<typeof CategorySchema> & {
  /** Resolved translation for the requested locale. Null if no translations exist. */
  translation: Pick<
    CategoryTranslation,
    "locale" | "slug" | "name" | "status"
  > | null;
  children: CategoryTree[];
};

export const CategoryTreeSchema: z.ZodType<CategoryTree> = z.lazy(() =>
  CategorySchema.extend({
    translation: z
      .object({
        locale: z.string(),
        slug: z.string(),
        name: z.string(),
        status: TranslationStatusEnum,
      })
      .nullable(),
    children: z.array(CategoryTreeSchema),
  }),
);

// ---------------------------------------------------------------------------
// TagTranslation
// ---------------------------------------------------------------------------

export const TagTranslationSchema = z.object({
  id: z.string().uuid(),
  tag_id: z.string().uuid(),
  /** BCP-47 locale code */
  locale: z.string().min(2),
  /** Display name in this locale, e.g. "wełna" (pl), "wool" (en) */
  name: z.string().min(1),
  status: TranslationStatusEnum,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
export type TagTranslation = z.infer<typeof TagTranslationSchema>;

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

export const TagTypeEnum = z.enum([
  "fiber_type",
  "needle_type",
  "garment_part",
  "style_tradition",
]);
export type TagType = z.infer<typeof TagTypeEnum>;

export const TagSchema = z.object({
  id: z.string().uuid(),
  /** Canonical English kebab-case identifier — never changes (e.g. "wool", "dpn", "fair-isle") */
  slug: z.string().min(1),
  type: TagTypeEnum.nullable(),
  /** Hex colour for UI badge rendering. */
  color_hex: z.string().nullable(),
});
export type Tag = z.infer<typeof TagSchema>;

/**
 * Tag with resolved display name for the active locale.
 * Used in entry detail, filter bars, and article tag lists.
 */
export const TagWithNameSchema = TagSchema.extend({
  /** Resolved display name for the requested locale. Falls back to slug if no translation. */
  name: z.string(),
});
export type TagWithName = z.infer<typeof TagWithNameSchema>;
