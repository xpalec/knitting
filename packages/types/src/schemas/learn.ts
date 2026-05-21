/**
 * Learning path schemas — curated ordered sequences of entries.
 *
 * LearningPath is a top-level entity with a slug and skill range.
 * LearningPathDetail includes the ordered entry list with active-locale translations.
 */

import { z } from "zod";
import { SkillLevelEnum } from "./entry.js";

// ---------------------------------------------------------------------------
// LearningPath — list item / summary
// ---------------------------------------------------------------------------

export const LearningPathSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  skill_level_min: SkillLevelEnum,
  skill_level_max: SkillLevelEnum,
  /** Denormalised; computed from entry count × average read time. */
  estimated_minutes: z.number().int().positive(),
  published: z.boolean(),
  /** Total number of entries in the path. */
  entry_count: z.number().int().nonnegative().optional(),
});
export type LearningPath = z.infer<typeof LearningPathSchema>;

// ---------------------------------------------------------------------------
// LearningPathEntry — one step in a path
// ---------------------------------------------------------------------------

/**
 * One entry within a learning path, with active-locale translation resolved.
 */
export const LearningPathEntrySchema = z.object({
  /** Position in the path (1-indexed). */
  sort_order: z.number().int().positive(),
  entry_id: z.string().uuid(),
  /** Resolved from Translation.term for the active locale. */
  term: z.string().min(1),
  /** Resolved from Translation.metadata.definition_short for the active locale. */
  definition_short: z.string().nullable(),
  skill_level: SkillLevelEnum.nullable(),
  /** Locale-specific slug for linking to the entry detail page. */
  slug: z.string().min(1),
  locale: z.string().min(2),
});
export type LearningPathEntry = z.infer<typeof LearningPathEntrySchema>;

// ---------------------------------------------------------------------------
// LearningPathDetail — full path with ordered entries
// ---------------------------------------------------------------------------

export const LearningPathDetailSchema = LearningPathSchema.extend({
  entries: z.array(LearningPathEntrySchema),
});
export type LearningPathDetail = z.infer<typeof LearningPathDetailSchema>;
