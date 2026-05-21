/**
 * `localePath` — builds locale-prefixed, segment-translated URL paths.
 *
 * Rules:
 * - Always use this helper; never construct paths manually.
 * - The locale prefix is always the BCP-47 code (e.g. `/pl/`, `/en/`).
 * - The page segment is translated via PATH_SEGMENTS for the given locale.
 * - An optional slug is appended as a final path segment.
 *
 * Examples:
 *   localePath("en", "entries")              → "/en/entries"
 *   localePath("pl", "entries")              → "/pl/wpisy"
 *   localePath("en", "entry", "yarn-over")   → "/en/entry/yarn-over"
 *   localePath("pl", "entry", "nawijak")     → "/pl/haslo/nawijak"
 */

import { type Locale, type PageKey, PATH_SEGMENTS } from "./segments.js";

/**
 * Builds a locale-prefixed path for the given page, optionally with a slug.
 *
 * @param locale - BCP-47 locale code (must be a supported `Locale`).
 * @param page   - Canonical page key (must be a `PageKey`).
 * @param slug   - Optional entry/article slug to append as the final segment.
 * @returns      Absolute path string starting with `/`.
 */
export function localePath(locale: Locale, page: PageKey, slug?: string): string {
  const segment = PATH_SEGMENTS[locale][page];
  const base = `/${locale}/${segment}`;
  return slug !== undefined && slug !== "" ? `${base}/${slug}` : base;
}
