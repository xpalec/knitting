import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Abbreviation, AbbreviationTranslation } from "@/lib/api/abbreviations";
import { rankAbbreviations, resolveTranslation } from "@/lib/abbreviations-utils";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/**
 * Generates valid Abbreviation objects with realistic codes.
 * Code uses alphanumeric characters to keep the abbreviation space representative.
 */
function abbreviationArbitrary(): fc.Arbitrary<Abbreviation> {
  return fc.record({
    id: fc.uuid(),
    code: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    source_language: fc.constantFrom("en", "no", "de", "fr", "pl"),
    translations: fc.constant([]),
    entry_abbreviations: fc.constant([]),
    created_at: fc.constant("2024-01-01T00:00:00Z"),
    updated_at: fc.constant("2024-01-01T00:00:00Z"),
  });
}

/**
 * Generates valid AbbreviationTranslation objects.
 * Locale uses short BCP-47-like strings to keep diversity manageable.
 */
function translationArbitrary(): fc.Arbitrary<AbbreviationTranslation> {
  return fc.record({
    id: fc.uuid(),
    abbreviation_id: fc.uuid(),
    locale: fc.oneof(
      fc.constantFrom("en", "no", "de", "fr", "pl"),
      fc.string({ minLength: 2, maxLength: 5 }).filter((s) => /^[a-z]{2,5}$/.test(s)),
    ),
    short_meaning: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    description: fc.constant(null),
    created_at: fc.constant("2024-01-01T00:00:00Z"),
    updated_at: fc.constant("2024-01-01T00:00:00Z"),
  });
}

// ─── Property 1 ──────────────────────────────────────────────────────────────

// Feature: admin-abbreviations, Property 1: rankAbbreviations preserves the rank ordering invariant

describe("rankAbbreviations — Property 1: rankAbbreviations preserves the rank ordering invariant", () => {
  /**
   * **Validates: Requirements 10.1, 10.2, 10.3**
   *
   * For any non-empty query and any list of abbreviations:
   * - tier ordering invariant holds for all consecutive pairs
   * - alphabetical order holds within each tier
   * - output length equals input length
   * - no throw on empty array
   */
  it("preserves rank ordering invariant, alphabetical within tier, and output length", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(abbreviationArbitrary(), { maxLength: 30 }),
        (query, abbreviations) => {
          const result = rankAbbreviations(query, abbreviations);
          const q = query.toLowerCase();

          const tierOf = (code: string) => {
            const c = code.toLowerCase();
            if (c === q) return 0;
            if (c.startsWith(q)) return 1;
            return 2;
          };

          // Tier ordering invariant: tier of element[i] <= tier of element[i+1]
          for (let i = 0; i < result.length - 1; i++) {
            const curr = result[i]!;
            const next = result[i + 1]!;
            expect(tierOf(curr.code)).toBeLessThanOrEqual(tierOf(next.code));
          }

          // Alphabetical within tier: same-tier consecutive pairs must be in order
          // Use localeCompare to match the implementation's sort comparator
          for (let i = 0; i < result.length - 1; i++) {
            const curr = result[i]!;
            const next = result[i + 1]!;
            if (tierOf(curr.code) === tierOf(next.code)) {
              expect(
                curr.code.toLowerCase().localeCompare(next.code.toLowerCase()),
              ).toBeLessThanOrEqual(0);
            }
          }

          // Output length equals input length (no elements added or dropped)
          expect(result.length).toBe(abbreviations.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns an empty array without throwing when given an empty input", () => {
    expect(() => rankAbbreviations("K2tog", [])).not.toThrow();
    expect(rankAbbreviations("K2tog", [])).toEqual([]);
  });
});

// ─── Property 2 ──────────────────────────────────────────────────────────────

// Feature: admin-abbreviations, Property 2: resolveTranslation follows the fallback chain for all inputs

describe("resolveTranslation — Property 2: resolveTranslation follows the fallback chain for all inputs", () => {
  /**
   * **Validates: Requirements 10.4, 10.5, 10.6, 10.7**
   *
   * For any locale string and any array of AbbreviationTranslation objects
   * (deduplicated by locale to respect the one-translation-per-locale invariant):
   * - exact locale match is returned when present
   * - `en` fallback is returned when no exact match exists
   * - `translations[0]` is returned when neither exact nor `en` exists but array is non-empty
   * - `null` is returned when the array is empty
   * - no throw on any input
   */
  it("follows the full fallback chain for all inputs", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.array(translationArbitrary(), { maxLength: 10 }),
        (locale, translations) => {
          // Deduplicate by locale to respect the one-translation-per-locale invariant
          const unique = Array.from(
            new Map(translations.map((t) => [t.locale, t])).values(),
          );

          const result = resolveTranslation(locale, unique);

          const exact = unique.find((t) => t.locale === locale);
          if (exact) {
            // Case 1: exact locale match exists — must return that element
            expect(result).toBe(exact);
          } else {
            const en = unique.find((t) => t.locale === "en");
            if (en) {
              // Case 2: no exact match, but `en` exists — must return `en` element
              expect(result).toBe(en);
            } else if (unique.length > 0) {
              // Case 3: neither exact nor `en` — must return first element
              expect(result).toBe(unique[0]);
            } else {
              // Case 4: empty array — must return null
              expect(result).toBeNull();
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns null without throwing when given an empty translations array", () => {
    expect(() => resolveTranslation("en", [])).not.toThrow();
    expect(resolveTranslation("en", [])).toBeNull();
  });
});
