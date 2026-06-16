import type { Abbreviation, AbbreviationTranslation } from "./api/abbreviations";

/**
 * Ranks abbreviations by how well their code matches the query string.
 *
 * Tier 0 — exact match (code.toLowerCase() === query.toLowerCase())
 * Tier 1 — prefix match (code.toLowerCase().startsWith(query.toLowerCase()))
 * Tier 2 — all other abbreviations
 *
 * Within each tier items are sorted alphabetically (case-insensitive).
 * Returns the input array unchanged when query is empty or the list is empty.
 */
export function rankAbbreviations(
  query: string,
  abbreviations: Abbreviation[],
): Abbreviation[] {
  if (!query || abbreviations.length === 0) return abbreviations;

  const q = query.toLowerCase();

  const tier = (code: string): 0 | 1 | 2 => {
    const c = code.toLowerCase();
    if (c === q) return 0;
    if (c.startsWith(q)) return 1;
    return 2;
  };

  return [...abbreviations].sort((a, b) => {
    const ta = tier(a.code);
    const tb = tier(b.code);
    if (ta !== tb) return ta - tb;
    return a.code.toLowerCase().localeCompare(b.code.toLowerCase());
  });
}

/**
 * Resolves the best available translation for the requested locale using the
 * fallback chain:
 *   1. Exact locale match
 *   2. English (`en`) fallback
 *   3. First element of the translations array
 *   4. `null` when the array is empty
 */
export function resolveTranslation(
  locale: string,
  translations: AbbreviationTranslation[],
): AbbreviationTranslation | null {
  if (translations.length === 0) return null;

  const exact = translations.find((t) => t.locale === locale);
  if (exact) return exact;

  const en = translations.find((t) => t.locale === "en");
  if (en) return en;

  return translations[0] ?? null;
}
