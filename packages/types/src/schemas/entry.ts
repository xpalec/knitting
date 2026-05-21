/**
 * Entry schemas — the core encyclopedia entry and its content blocks.
 *
 * Key design rules encoded here:
 * - Entry has NO `slug`, `term`, or `search_vector` — those live in Translation.
 * - `origin_language` is a constrained column (BCP-47 codes only).
 * - `content_blocks` is a pure layout manifest; translated content lives in Translation.blocks.
 * - ContentBlockSchema is a discriminated union on `type`; each variant adds its own fields.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SkillLevelEnum = z.enum(["beginner", "intermediate", "advanced", "expert"]);
export type SkillLevel = z.infer<typeof SkillLevelEnum>;

export const EntryStatusEnum = z.enum(["draft", "review", "published", "deprecated"]);
export type EntryStatus = z.infer<typeof EntryStatusEnum>;

/**
 * BCP-47 origin language codes — the traditions the encyclopedia covers.
 * Constrained to the five supported origin languages (distinct from UI locales).
 */
export const OriginLanguageEnum = z.enum(["en", "pl", "no", "de", "fr"]);
export type OriginLanguage = z.infer<typeof OriginLanguageEnum>;

// ---------------------------------------------------------------------------
// ContentBlock — discriminated union on `type`
// ---------------------------------------------------------------------------

/** Base fields shared by every block type. */
const ContentBlockBaseSchema = z.object({
  /** Stable UUID — used as the key in Translation.blocks. Never reuse. */
  id: z.string().uuid(),
  /** Sort position; lower = higher on page. */
  order: z.number().int().nonnegative(),
  /** false = hidden but not deleted (soft-remove by admin). */
  visible: z.boolean(),
});

/** Prose definition block. Translated content is TipTap JSON in Translation.blocks[id]. */
export const DefinitionBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("definition"),
});

/**
 * How-to instructions block.
 * Translation.blocks[id]: { name, difficulty, steps[] }
 */
export const TechniqueBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("technique"),
});

/**
 * Media block — references one MediaAsset by ID.
 * assetId is locale-independent; alt text and caption live in Translation.blocks[id].
 */
export const MediaBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("media"),
  /** References MediaAsset.id — locale-independent CDN URL. */
  assetId: z.string().uuid(),
});

/**
 * Editorial callout box.
 * `variant` is non-translatable config stored on the block itself.
 * Translation.blocks[id]: { text }
 */
export const CalloutBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("callout"),
  variant: z.enum(["tip", "warning"]),
});

/**
 * Related entries section — synonym, prerequisite, variant cards.
 * No Translation.blocks entry needed; labels come from linked Translation rows.
 */
export const RelatedBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("related"),
});

/**
 * PatternUsage list with context notes and frequency bars.
 * No Translation.blocks entry needed.
 */
export const PatternUsageBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("pattern_usage"),
});

// Post-launch block types — included so the schema accepts them without migration.
export const AdSlotBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("ad_slot"),
  slotId: z.string(),
});

export const InteractiveBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("interactive"),
  componentId: z.string(),
  props: z.record(z.string(), z.unknown()),
});

export const QuizBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("quiz"),
  questionId: z.string(),
});

export const VideoBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("video"),
  url: z.string().url(),
});

export const DividerBlockSchema = ContentBlockBaseSchema.extend({
  type: z.literal("divider"),
});

/**
 * Full discriminated union of all known block types.
 * Adding a new block type: add a new schema above and a new branch here.
 */
export const ContentBlockSchema = z.discriminatedUnion("type", [
  DefinitionBlockSchema,
  TechniqueBlockSchema,
  MediaBlockSchema,
  CalloutBlockSchema,
  RelatedBlockSchema,
  PatternUsageBlockSchema,
  AdSlotBlockSchema,
  InteractiveBlockSchema,
  QuizBlockSchema,
  VideoBlockSchema,
  DividerBlockSchema,
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

// ---------------------------------------------------------------------------
// Entry metadata
// ---------------------------------------------------------------------------

/**
 * Well-known keys on Entry.metadata.
 * Open-ended: additional keys (reversible, stretchiness, etc.) are allowed via passthrough.
 */
export const EntryMetadataSchema = z
  .object({
    skill_level: SkillLevelEnum.optional(),
    /** ≤160 chars. English canonical summary — fallback when no locale-native definition_short exists. */
    definition_short: z.string().max(160).optional(),
  })
  .passthrough(); // allow open-ended corpus-specific keys
export type EntryMetadata = z.infer<typeof EntryMetadataSchema>;

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/**
 * Core encyclopedia entry.
 * No slug, term, or search_vector — those live in Translation rows.
 */
export const EntrySchema = z.object({
  id: z.string().uuid(),
  origin_language: OriginLanguageEnum,
  status: EntryStatusEnum,
  metadata: EntryMetadataSchema,
  /** Ordered layout manifest. Translated content lives in Translation.blocks keyed by block ID. */
  content_blocks: z.array(ContentBlockSchema),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
});
export type Entry = z.infer<typeof EntrySchema>;

// ---------------------------------------------------------------------------
// EntryListItem — flattened shape for list rows
// ---------------------------------------------------------------------------

/**
 * Flattened entry row for list pages.
 * term and abbreviation are resolved from the active Translation row by the API.
 */
export const EntryListItemSchema = z.object({
  id: z.string().uuid(),
  origin_language: OriginLanguageEnum,
  status: EntryStatusEnum,
  skill_level: SkillLevelEnum.nullable(),
  /** Resolved from Translation.term for the requested locale. */
  term: z.string(),
  /** Resolved from Translation.metadata.abbreviation for the requested locale. */
  abbreviation: z.string().nullable(),
  /** Resolved from Translation.metadata.definition_short for the requested locale. */
  definition_short: z.string().nullable(),
  /** True when the entry has no Translation for the requested locale; term is from `en` fallback. */
  missing_translation: z.boolean(),
  locale: z.string(),
  slug: z.string(),
});
export type EntryListItem = z.infer<typeof EntryListItemSchema>;
