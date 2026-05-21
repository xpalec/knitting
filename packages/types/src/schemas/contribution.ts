/**
 * Contribution schemas — public submission forms.
 *
 * Three submission types:
 * - entry: propose a new encyclopedia entry
 * - translation: contribute a translation for an existing entry
 * - correction: report an error in an existing entry
 *
 * Security note: translation submissions identify the target entry via
 * Translation.slug — never via raw entry_id (which is internal).
 */

import { z } from "zod";
import { OriginLanguageEnum, SkillLevelEnum } from "./entry.js";

// ---------------------------------------------------------------------------
// Contribution status
// ---------------------------------------------------------------------------

export const ContributionStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type ContributionStatus = z.infer<typeof ContributionStatusEnum>;

export const ContributionTypeEnum = z.enum(["entry", "translation", "correction"]);
export type ContributionType = z.infer<typeof ContributionTypeEnum>;

// ---------------------------------------------------------------------------
// Entry submission
// ---------------------------------------------------------------------------

/**
 * Public form for proposing a new encyclopedia entry.
 * Rate limit: 5 per IP per hour.
 */
export const EntrySubmissionSchema = z.object({
  /** Display name of the term being submitted. */
  term: z.string().min(1).max(200),
  /** Plain-text definition (not TipTap JSON — editors format it on approval). */
  definition: z.string().min(10).max(2000),
  /** Category slug the submitter believes this entry belongs to. */
  category_slug: z.string().min(1).optional(),
  skill_level: SkillLevelEnum.optional(),
  /** BCP-47 origin language — which tradition this term comes from. */
  origin_language: OriginLanguageEnum,
  /** Locale-specific abbreviation, e.g. `yo`, `yfwd`. */
  abbreviation: z.string().max(20).optional(),
  /** Optional — used for status notification. */
  submitter_email: z.string().email().optional(),
});
export type EntrySubmission = z.infer<typeof EntrySubmissionSchema>;

// ---------------------------------------------------------------------------
// Translation submission
// ---------------------------------------------------------------------------

/**
 * Public form for contributing a translation for an existing entry.
 * Rate limit: 20 per IP per hour.
 *
 * The target entry is identified by (locale, slug) — never by entry_id.
 * The API resolves entry_id internally from the Translation lookup.
 */
export const TranslationSubmissionSchema = z.object({
  /**
   * The locale + slug of the existing entry being translated.
   * Used to resolve the entry_id server-side — never accept raw entry_id from public.
   */
  source_locale: z.string().min(2),
  source_slug: z.string().min(1),
  /** The locale being contributed. */
  target_locale: z.string().min(2),
  /** Translated display name. */
  translated_term: z.string().min(1).max(200),
  /** Plain-text translated definition. */
  translated_definition: z.string().min(10).max(2000),
  /** Locale-specific abbreviation in the target language. */
  abbreviation: z.string().max(20).optional(),
  submitter_email: z.string().email().optional(),
});
export type TranslationSubmission = z.infer<typeof TranslationSubmissionSchema>;

// ---------------------------------------------------------------------------
// Correction report
// ---------------------------------------------------------------------------

/**
 * Lightweight correction report — opened from the entry detail page.
 * Rate limit: 10 per IP per hour.
 */
export const CorrectionSchema = z.object({
  /** Locale + slug of the entry being corrected — identifies the Translation row. */
  locale: z.string().min(2),
  slug: z.string().min(1),
  /** Which field the correction applies to, e.g. "term", "definition", "abbreviation". */
  field: z.string().min(1),
  /** The current (incorrect) value. */
  current_value: z.string().min(1),
  /** The suggested correct value. */
  suggested_value: z.string().min(1),
  /** Optional context explaining the correction. */
  note: z.string().max(1000).optional(),
  submitter_email: z.string().email().optional(),
});
export type Correction = z.infer<typeof CorrectionSchema>;

// ---------------------------------------------------------------------------
// Contribution row — the stored record in the DB
// ---------------------------------------------------------------------------

/**
 * Full Contribution row as returned by the admin queue API.
 */
export const ContributionSchema = z.object({
  id: z.string().uuid(),
  type: ContributionTypeEnum,
  status: ContributionStatusEnum,
  /** Raw submitted payload — shape depends on type. */
  payload: z.record(z.string(), z.unknown()),
  /** Set for translation and correction submissions. */
  entry_id: z.string().uuid().nullable(),
  submitter_email: z.string().email().nullable(),
  reviewer_note: z.string().nullable(),
  submitted_at: z.string().datetime(),
  reviewed_at: z.string().datetime().nullable(),
});
export type Contribution = z.infer<typeof ContributionSchema>;
