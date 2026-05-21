/**
 * Shared domain types, Zod schemas, and i18n helpers for the knitting encyclopedia.
 *
 * All types, schemas, and utilities are re-exported from this single entry point.
 * Import from "@knitting/types" in app code — never from internal paths.
 */

// i18n — locale constants, path segments, localePath helper
export {
  DEFAULT_LOCALE,
  localePath,
  PAGE_KEYS,
  PATH_SEGMENTS,
  SEGMENT_TO_CANONICAL,
  SUPPORTED_LOCALES,
} from "./i18n/index.js";
export type { Locale, PageKey } from "./i18n/index.js";

// Zod schemas and inferred TypeScript types
export * from "./schemas/index.js";

// Zustand store shape
export type { KnittingStore, LearnProgress } from "./store.js";
