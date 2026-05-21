/**
 * Translation schemas — all locale-specific content for an entry.
 *
 * Key design rules encoded here:
 * - One Translation row per locale per entry.
 * - Translation.blocks is keyed by ContentBlock.id; shape per key depends on block type.
 * - search_vector is a DB-only field (tsvector); not included in API response schemas.
 * - abbreviation and definition_short are locale-specific and live in Translation.metadata.
 */

import { z } from "zod";
import { SkillLevelEnum } from "./entry.js";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const TranslationStatusEnum = z.enum(["draft", "reviewed", "published"]);
export type TranslationStatus = z.infer<typeof TranslationStatusEnum>;

// ---------------------------------------------------------------------------
// Translation metadata
// ---------------------------------------------------------------------------

/**
 * Well-known keys on Translation.metadata.
 * Open-ended: additional locale-specific keys are allowed via passthrough.
 */
export const TranslationMetadataSchema = z
  .object({
    /** Locale-specific abbreviation, e.g. `yo`, `yfwd`, `ścr`. */
    abbreviation: z.string().optional(),
    /** ≤160 chars. Locale-native summary for tooltips, search snippets, social previews. */
    definition_short: z.string().max(160).optional(),
  })
  .passthrough();
export type TranslationMetadata = z.infer<typeof TranslationMetadataSchema>;

// ---------------------------------------------------------------------------
// Block content shapes — Translation.blocks[blockId]
// ---------------------------------------------------------------------------

/**
 * TipTap inline node types permitted in a definition block.
 * Recursive: content nodes can contain further inline nodes.
 */
export type TipTapNode = {
  type: string;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};

const TipTapNodeSchema: z.ZodType<TipTapNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(TipTapNodeSchema).optional(),
  }),
);

/**
 * TipTap document root — the shape stored for a `definition` block.
 * Permitted nodes: paragraph, hard_break, bold (mark), italic (mark),
 * entry_link (custom inline: { entryId, term }).
 */
export const DefinitionBlockContentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(TipTapNodeSchema),
});
export type DefinitionBlockContent = z.infer<typeof DefinitionBlockContentSchema>;

/** One step in a technique block. */
export const TechniqueStepSchema = z.object({
  order: z.number().int().positive(),
  text: z.string().min(1),
});
export type TechniqueStep = z.infer<typeof TechniqueStepSchema>;

/**
 * Translated content for a `technique` block.
 * difficulty reuses SkillLevelEnum — same vocabulary as Entry.metadata.skill_level.
 */
export const TechniqueBlockContentSchema = z.object({
  name: z.string().min(1),
  difficulty: SkillLevelEnum,
  steps: z.array(TechniqueStepSchema).min(1),
});
export type TechniqueBlockContent = z.infer<typeof TechniqueBlockContentSchema>;

/**
 * Translated content for a `media` block.
 * URL lives on MediaAsset (locale-independent); only alt text and caption are translated.
 */
export const MediaBlockContentSchema = z.object({
  alt_text: z.string().min(1),
  caption: z.string().optional(),
});
export type MediaBlockContent = z.infer<typeof MediaBlockContentSchema>;

/** Translated content for a `callout` block. */
export const CalloutBlockContentSchema = z.object({
  text: z.string().min(1),
});
export type CalloutBlockContent = z.infer<typeof CalloutBlockContentSchema>;

/**
 * Union of all typed block content shapes.
 * `related` and `pattern_usage` blocks have no Translation.blocks entry.
 */
export const BlockContentSchema = z.union([
  DefinitionBlockContentSchema,
  TechniqueBlockContentSchema,
  MediaBlockContentSchema,
  CalloutBlockContentSchema,
]);
export type BlockContent = z.infer<typeof BlockContentSchema>;

/**
 * Translation.blocks — keyed by ContentBlock.id (stable UUID).
 * Values are typed block content; unknown() allows future block types without schema changes.
 */
export const BlocksSchema = z.record(z.string().uuid(), z.unknown());
export type Blocks = z.infer<typeof BlocksSchema>;

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Full Translation row — all locale-specific content for one entry in one locale.
 * search_vector is omitted — it is a DB-internal tsvector, never returned by the API.
 */
export const TranslationSchema = z.object({
  id: z.string().uuid(),
  entry_id: z.string().uuid(),
  /** BCP-47 locale code, e.g. `en`, `pl`, `en-US`, `en-GB`. */
  locale: z.string().min(2),
  /** Locale-specific public URL slug. Immutable once published. */
  slug: z.string().min(1),
  /** Display name in this locale. The `en` row's term is the canonical English name. */
  term: z.string().min(1),
  metadata: TranslationMetadataSchema,
  blocks: BlocksSchema,
  translator_note: z.string().nullable(),
  status: TranslationStatusEnum,
});
export type Translation = z.infer<typeof TranslationSchema>;

// ---------------------------------------------------------------------------
// API response shape — entry detail translation section
// ---------------------------------------------------------------------------

/**
 * The translation section returned inside the entry detail API response.
 * Includes typed metadata and blocks alongside the core fields.
 */
export const EntryDetailTranslationSchema = TranslationSchema.omit({
  entry_id: true,
  translator_note: true,
});
export type EntryDetailTranslation = z.infer<typeof EntryDetailTranslationSchema>;
