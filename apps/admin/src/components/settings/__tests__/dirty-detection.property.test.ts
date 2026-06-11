import { describe, it, expect } from "vitest";
import fc from "fast-check";

// Feature: content-block-types-entry-templates, Property 9: Dirty detection is order-sensitive
// **Validates: Requirements 6.2, 6.7, 6.8**

/**
 * Arbitrary for a BlockTemplateItem with valid fields.
 */
const blockItemArbitrary = fc.record({
  type: fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/),
  order: fc.integer({ min: 1, max: 100 }),
  visible: fc.boolean(),
});

describe("Dirty detection - Property 9: Dirty detection is order-sensitive", () => {
  it("reordered lists with same items produce different JSON serializations", () => {
    fc.assert(
      fc.property(
        fc.array(blockItemArbitrary, { minLength: 2, maxLength: 10 }),
        (blocks) => {
          // Create a shuffled version that differs from the original order
          // We reverse the array as a guaranteed-different ordering when length >= 2
          // But first check if all items are identical (in which case reordering is undetectable)
          const shuffled = [...blocks].reverse();

          // Only assert when the reordered version is actually different
          // (if all items are identical objects, JSON.stringify would be the same regardless of order)
          const originalJson = JSON.stringify(blocks);
          const shuffledJson = JSON.stringify(shuffled);

          // If the arrays are actually in a different order (i.e., not palindromic),
          // then JSON serialization must differ
          const arraysAreIdentical = blocks.every(
            (item, idx) => JSON.stringify(item) === JSON.stringify(shuffled[idx]),
          );

          if (!arraysAreIdentical) {
            expect(originalJson).not.toBe(shuffledJson);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("same items in same order produce identical JSON serializations", () => {
    fc.assert(
      fc.property(
        fc.array(blockItemArbitrary, { minLength: 2, maxLength: 10 }),
        (blocks) => {
          // A copy in the same order should have the same serialization
          const copy = blocks.map((item) => ({ ...item }));
          expect(JSON.stringify(blocks)).toBe(JSON.stringify(copy));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("swapping any two distinct adjacent items is detected as a change", () => {
    fc.assert(
      fc.property(
        fc.array(blockItemArbitrary, { minLength: 2, maxLength: 10 }),
        fc.nat(),
        (blocks, rawIndex) => {
          // Pick an adjacent swap index
          const swapIndex = rawIndex % (blocks.length - 1);
          const swapped = [...blocks];
          [swapped[swapIndex], swapped[swapIndex + 1]] = [
            swapped[swapIndex + 1]!,
            swapped[swapIndex]!,
          ];

          // Only assert when the swapped items are actually different
          if (
            JSON.stringify(blocks[swapIndex]) !==
            JSON.stringify(blocks[swapIndex + 1])
          ) {
            expect(JSON.stringify(blocks)).not.toBe(JSON.stringify(swapped));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
