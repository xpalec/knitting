import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  deriveTranslationStatus,
  type ContentBlockType,
  type Locale,
  SUPPORTED_LOCALES,
} from "@/lib/api/content-block-types";

// Feature: content-block-types-entry-templates, Property 2: Translation_Status derivation is correct
// **Validates: Requirements 2.7**

/**
 * Arbitrary for a ContentBlockType with configurable translation state per locale.
 * We generate random translations maps to cover all three derivation cases:
 * - missing (no key for locale)
 * - incomplete (key exists, heading is empty string)
 * - complete (key exists, heading is non-empty string)
 */
const localeArbitrary: fc.Arbitrary<Locale> = fc.constantFrom(
  ...SUPPORTED_LOCALES,
);

const contentBlockTypeArbitrary: fc.Arbitrary<ContentBlockType> = fc.record({
  id: fc.uuid(),
  type: fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/),
  label: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  translations: fc.record({
    en: fc.option(fc.record({ heading: fc.string() }), { nil: undefined }),
    pl: fc.option(fc.record({ heading: fc.string() }), { nil: undefined }),
  }) as fc.Arbitrary<
    Partial<Record<Locale, { heading: string }>>
  >,
  created_at: fc.constant("2024-01-01T00:00:00Z"),
  updated_at: fc.constant("2024-01-01T00:00:00Z"),
});

describe("deriveTranslationStatus - Property 2: Translation_Status derivation is correct", () => {
  it('returns "missing" when no translation record exists for the locale', () => {
    fc.assert(
      fc.property(contentBlockTypeArbitrary, localeArbitrary, (blockType, locale) => {
        // Force the translation for this locale to be absent
        const modified: ContentBlockType = {
          ...blockType,
          translations: { ...blockType.translations },
        };
        delete modified.translations[locale];

        const result = deriveTranslationStatus(modified, locale);
        expect(result).toBe("missing");
      }),
      { numRuns: 100 },
    );
  });

  it('returns "incomplete" when translation record exists but heading is empty', () => {
    fc.assert(
      fc.property(contentBlockTypeArbitrary, localeArbitrary, (blockType, locale) => {
        // Force the translation for this locale to have an empty heading
        const modified: ContentBlockType = {
          ...blockType,
          translations: {
            ...blockType.translations,
            [locale]: { heading: "" },
          },
        };

        const result = deriveTranslationStatus(modified, locale);
        expect(result).toBe("incomplete");
      }),
      { numRuns: 100 },
    );
  });

  it('returns "complete" when translation record exists and heading is non-empty', () => {
    fc.assert(
      fc.property(
        contentBlockTypeArbitrary,
        localeArbitrary,
        fc.string({ minLength: 1 }),
        (blockType, locale, heading) => {
          // Force the translation for this locale to have a non-empty heading
          const modified: ContentBlockType = {
            ...blockType,
            translations: {
              ...blockType.translations,
              [locale]: { heading },
            },
          };

          const result = deriveTranslationStatus(modified, locale);
          expect(result).toBe("complete");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("correctly derives status for arbitrary block types and locales without modification", () => {
    fc.assert(
      fc.property(contentBlockTypeArbitrary, localeArbitrary, (blockType, locale) => {
        const result = deriveTranslationStatus(blockType, locale);
        const translation = blockType.translations[locale];

        if (!translation) {
          expect(result).toBe("missing");
        } else if (translation.heading && translation.heading.length > 0) {
          expect(result).toBe("complete");
        } else {
          expect(result).toBe("incomplete");
        }
      }),
      { numRuns: 100 },
    );
  });
});
