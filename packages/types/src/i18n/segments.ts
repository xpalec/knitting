/**
 * i18n routing constants for the knitting encyclopedia.
 *
 * Rules:
 * - Never hardcode locale strings in app code — use `Locale` and `SUPPORTED_LOCALES`.
 * - Never construct paths manually — use `localePath()`.
 * - Locale lives in the URL; never store it in Zustand or localStorage.
 */

// ---------------------------------------------------------------------------
// Locales
// ---------------------------------------------------------------------------

/** All BCP-47 locale codes supported by the public encyclopedia. Extend here. */
export const SUPPORTED_LOCALES = ["en", "pl"] as const;

/** Union of all supported locale codes. */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** The locale used when no preference can be detected. */
export const DEFAULT_LOCALE: Locale = "en";

// ---------------------------------------------------------------------------
// Page keys
// ---------------------------------------------------------------------------

/**
 * Canonical (English) page-segment identifiers.
 * These are the internal keys used throughout app code — never the raw URL strings.
 */
export const PAGE_KEYS = [
  "entries",
  "entry",
  "articles",
  "article",
  "learn",
  "search",
  "map",
  "country",
  "contribute",
] as const;

/** Union of all canonical page-segment keys. */
export type PageKey = (typeof PAGE_KEYS)[number];

// ---------------------------------------------------------------------------
// PATH_SEGMENTS
// ---------------------------------------------------------------------------

/**
 * Locale-specific URL path segments, keyed by locale then by canonical page key.
 *
 * English uses the canonical key as-is (no translation needed).
 * Each additional locale provides its own native segment string.
 *
 * Example:
 *   PATH_SEGMENTS["pl"]["entries"] === "wpisy"
 *   PATH_SEGMENTS["en"]["entries"] === "entries"
 */
export const PATH_SEGMENTS: Record<Locale, Record<PageKey, string>> = {
  en: {
    entries: "entries",
    entry: "entry",
    articles: "articles",
    article: "article",
    learn: "learn",
    search: "search",
    map: "map",
    country: "country",
    contribute: "contribute",
  },
  pl: {
    entries: "wpisy",
    entry: "haslo",
    articles: "artykuly",
    article: "artykul",
    learn: "nauka",
    search: "szukaj",
    map: "mapa",
    country: "kraj",
    contribute: "dodaj",
  },
};

// ---------------------------------------------------------------------------
// SEGMENT_TO_CANONICAL
// ---------------------------------------------------------------------------

/**
 * Reverse map: any locale's URL segment string → canonical PageKey.
 *
 * Used by Next.js middleware to rewrite localised paths to their canonical
 * form before routing. For example:
 *   "/pl/wpisy/yarn-over" → "/pl/entries/yarn-over"
 *
 * Includes English segments too so the map is exhaustive.
 */
export const SEGMENT_TO_CANONICAL: Record<string, PageKey> = Object.fromEntries(
  SUPPORTED_LOCALES.flatMap((locale) =>
    PAGE_KEYS.map((key) => [PATH_SEGMENTS[locale][key], key] as const),
  ),
);
