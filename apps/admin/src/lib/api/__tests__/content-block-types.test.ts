import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isValidSlug } from "@/lib/api/content-block-types";

// Feature: content-block-types-entry-templates, Property 1: Slug validation accepts only valid patterns
describe("isValidSlug", () => {
  const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

  it("returns true if and only if the string matches ^[a-z][a-z0-9_]*$", () => {
    // **Validates: Requirements 1.8**
    fc.assert(
      fc.property(fc.string(), (s) => {
        const expected = SLUG_PATTERN.test(s);
        const actual = isValidSlug(s);
        expect(actual).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("accepts all strings that match the slug pattern", () => {
    // **Validates: Requirements 1.8**
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/), (s) => {
        expect(isValidSlug(s)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
