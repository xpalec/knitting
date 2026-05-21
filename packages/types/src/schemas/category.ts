/**
 * Category schemas — hierarchical taxonomy for encyclopedia entries.
 *
 * Categories support unlimited depth via parent_id self-join.
 * 2–3 levels recommended in practice.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Category
// ---------------------------------------------------------------------------

export const CategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  /** URL-safe identifier. Unique across all categories. */
  slug: z.string().min(1),
  /** Null for top-level categories. */
  parent_id: z.string().uuid().nullable(),
  /** Icon key or SVG path for UI rendering. */
  icon: z.string().nullable(),
  /** Display ordering within parent. Lower = earlier. */
  sort_order: z.number().int().nonnegative(),
});
export type Category = z.infer<typeof CategorySchema>;

// ---------------------------------------------------------------------------
// CategoryTree — nested structure for the full category tree API response
// ---------------------------------------------------------------------------

/**
 * Recursive category tree node.
 * The API returns the full tree in one response; children are nested inline.
 */
export type CategoryTree = z.infer<typeof CategorySchema> & {
  children: CategoryTree[];
  entry_count?: number;
};

export const CategoryTreeSchema: z.ZodType<CategoryTree> = z.lazy(() =>
  CategorySchema.extend({
    children: z.array(CategoryTreeSchema),
    /** Total entries in this category and all descendants. */
    entry_count: z.number().int().nonnegative().optional(),
  }),
);
