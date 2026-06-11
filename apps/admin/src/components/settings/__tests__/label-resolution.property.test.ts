import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ContentBlockType } from "@/lib/api/content-block-types";

// Feature: content-block-types-entry-templates, Property 11: Block type label resolution
// **Validates: Requirements 5.4, 5.5**

/**
 * Pure function under test — same logic as defined inline in entry-templates/page.tsx.
 * For any type slug that matches exactly one ContentBlockType in the registry,
 * the resolved label equals that ContentBlockType.label; if no match exists,
 * the resolved label equals the raw type slug string.
 */
function resolveLabel(typeSlug: string, blockTypes: ContentBlockType[] | undefined): string {
  return blockTypes?.find((bt) => bt.type === typeSlug)?.label ?? typeSlug;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const contentBlockTypeArbitrary: fc.Arbitrary<Pick<ContentBlockType, "id" | "type" | "label">> =
  fc.record({
    id: fc.uuid(),
    type: fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/),
    label: fc.string({ minLength: 1, maxLength: 50 }),
  });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveLabel - Property 11: Block type label resolution", () => {
  it("returns ContentBlockType.label when the slug matches a registered block type", () => {
    fc.assert(
      fc.property(
        fc.array(contentBlockTypeArbitrary, { minLength: 1, maxLength: 20 }),
        (blockTypes) => {
          // Pick a random block type from the array to use as the matching slug
          const target = blockTypes[0]!;
          const result = resolveLabel(target.type, blockTypes as ContentBlockType[]);
          // The first matching block type's label should be returned
          const expected = blockTypes.find((bt) => bt.type === target.type)!.label;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns the raw slug when no block type matches", () => {
    fc.assert(
      fc.property(
        fc.array(contentBlockTypeArbitrary, { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        (blockTypes, rawSlug) => {
          // Ensure the rawSlug doesn't match any block type in the array
          const nonMatchingSlug = `__unmatched_${rawSlug}`;
          const result = resolveLabel(nonMatchingSlug, blockTypes as ContentBlockType[]);
          expect(result).toBe(nonMatchingSlug);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns the raw slug when blockTypes is undefined", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (slug) => {
          const result = resolveLabel(slug, undefined);
          expect(result).toBe(slug);
        },
      ),
      { numRuns: 100 },
    );
  });
});
