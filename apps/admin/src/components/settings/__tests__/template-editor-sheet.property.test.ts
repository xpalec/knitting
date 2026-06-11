import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  renumber,
  moveUp,
  moveDown,
  removeBlock,
  toggleVisible,
  addBlock,
} from "@/components/settings/template-editor-sheet";
import type { BlockTemplateItem } from "@/lib/api/templates";

// Feature: content-block-types-entry-templates, Property 4: addBlock appends correctly and preserves invariants
// Feature: content-block-types-entry-templates, Property 5: moveUp swaps and produces contiguous order
// Feature: content-block-types-entry-templates, Property 6: moveDown swaps and produces contiguous order
// Feature: content-block-types-entry-templates, Property 7: toggleVisible flips only the target item
// Feature: content-block-types-entry-templates, Property 8: removeBlock produces contiguous order
// Feature: content-block-types-entry-templates, Property 10: renumber produces contiguous 1-based order
// Feature: content-block-types-entry-templates, Property 13: moveUp at boundary is identity
// Feature: content-block-types-entry-templates, Property 14: moveDown at boundary is identity
// **Validates: Requirements 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13**

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const blockItemArbitrary: fc.Arbitrary<BlockTemplateItem> = fc.record({
  type: fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/),
  order: fc.integer({ min: 1, max: 100 }),
  visible: fc.boolean(),
});

const blockListArbitrary = fc.array(blockItemArbitrary, { minLength: 0, maxLength: 20 });
const nonEmptyBlockListArbitrary = fc.array(blockItemArbitrary, { minLength: 1, maxLength: 20 });
const twoOrMoreBlockListArbitrary = fc.array(blockItemArbitrary, { minLength: 2, maxLength: 20 });

// ---------------------------------------------------------------------------
// Property 4: addBlock appends correctly and preserves invariants
// ---------------------------------------------------------------------------

describe("Property 4: addBlock appends correctly and preserves invariants", () => {
  it("produces a list of length N+1 with correct last item and preserves preceding items", () => {
    fc.assert(
      fc.property(
        blockListArbitrary,
        fc.stringMatching(/^[a-z][a-z0-9_]{0,20}$/),
        (blocks, type) => {
          const result = addBlock(blocks, type);

          // Length is N+1
          expect(result).toHaveLength(blocks.length + 1);

          // Last item has the given type, order N+1, visible=true
          const lastItem = result[result.length - 1]!;
          expect(lastItem.type).toBe(type);
          expect(lastItem.order).toBe(blocks.length + 1);
          expect(lastItem.visible).toBe(true);

          // All preceding items retain their original type and visible values
          for (let k = 0; k < blocks.length; k++) {
            expect(result[k]!.type).toBe(blocks[k]!.type);
            expect(result[k]!.visible).toBe(blocks[k]!.visible);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: moveUp swaps and produces contiguous order
// ---------------------------------------------------------------------------

describe("Property 5: moveUp swaps and produces contiguous order", () => {
  it("swaps items at i and i-1, and every item at position k has order===k+1", () => {
    fc.assert(
      fc.property(
        twoOrMoreBlockListArbitrary.chain((blocks) =>
          fc.tuple(
            fc.constant(blocks),
            fc.integer({ min: 1, max: blocks.length - 1 }),
          ),
        ),
        ([blocks, i]) => {
          const result = moveUp(blocks, i);

          // Items were swapped
          expect(result[i - 1]!.type).toBe(blocks[i]!.type);
          expect(result[i - 1]!.visible).toBe(blocks[i]!.visible);
          expect(result[i]!.type).toBe(blocks[i - 1]!.type);
          expect(result[i]!.visible).toBe(blocks[i - 1]!.visible);

          // Contiguous order
          for (let k = 0; k < result.length; k++) {
            expect(result[k]!.order).toBe(k + 1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: moveDown swaps and produces contiguous order
// ---------------------------------------------------------------------------

describe("Property 6: moveDown swaps and produces contiguous order", () => {
  it("swaps items at i and i+1, and every item at position k has order===k+1", () => {
    fc.assert(
      fc.property(
        twoOrMoreBlockListArbitrary.chain((blocks) =>
          fc.tuple(
            fc.constant(blocks),
            fc.integer({ min: 0, max: blocks.length - 2 }),
          ),
        ),
        ([blocks, i]) => {
          const result = moveDown(blocks, i);

          // Items were swapped
          expect(result[i + 1]!.type).toBe(blocks[i]!.type);
          expect(result[i + 1]!.visible).toBe(blocks[i]!.visible);
          expect(result[i]!.type).toBe(blocks[i + 1]!.type);
          expect(result[i]!.visible).toBe(blocks[i + 1]!.visible);

          // Contiguous order
          for (let k = 0; k < result.length; k++) {
            expect(result[k]!.order).toBe(k + 1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: toggleVisible flips only the target item
// ---------------------------------------------------------------------------

describe("Property 7: toggleVisible flips only the target item", () => {
  it("flips visible for item at i and leaves all others unchanged", () => {
    fc.assert(
      fc.property(
        nonEmptyBlockListArbitrary.chain((blocks) =>
          fc.tuple(
            fc.constant(blocks),
            fc.integer({ min: 0, max: blocks.length - 1 }),
          ),
        ),
        ([blocks, i]) => {
          const result = toggleVisible(blocks, i);

          // Target item has flipped visible
          expect(result[i]!.visible).toBe(!blocks[i]!.visible);

          // All other items unchanged
          for (let k = 0; k < blocks.length; k++) {
            if (k !== i) {
              expect(result[k]!.type).toBe(blocks[k]!.type);
              expect(result[k]!.order).toBe(blocks[k]!.order);
              expect(result[k]!.visible).toBe(blocks[k]!.visible);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: removeBlock produces contiguous order
// ---------------------------------------------------------------------------

describe("Property 8: removeBlock produces contiguous order", () => {
  it("produces length N-1 with the removed item absent and contiguous order", () => {
    fc.assert(
      fc.property(
        nonEmptyBlockListArbitrary.chain((blocks) =>
          fc.tuple(
            fc.constant(blocks),
            fc.integer({ min: 0, max: blocks.length - 1 }),
          ),
        ),
        ([blocks, i]) => {
          const result = removeBlock(blocks, i);

          // Length is N-1
          expect(result).toHaveLength(blocks.length - 1);

          // Contiguous order
          for (let k = 0; k < result.length; k++) {
            expect(result[k]!.order).toBe(k + 1);
          }

          // The item originally at position i is absent — items before i kept, items after i shifted
          for (let k = 0; k < i; k++) {
            expect(result[k]!.type).toBe(blocks[k]!.type);
            expect(result[k]!.visible).toBe(blocks[k]!.visible);
          }
          for (let k = i; k < result.length; k++) {
            expect(result[k]!.type).toBe(blocks[k + 1]!.type);
            expect(result[k]!.visible).toBe(blocks[k + 1]!.visible);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: renumber produces contiguous 1-based order
// ---------------------------------------------------------------------------

describe("Property 10: renumber produces contiguous 1-based order", () => {
  it("produces same length where position k has order===k+1 and type/visible unchanged", () => {
    fc.assert(
      fc.property(blockListArbitrary, (blocks) => {
        const result = renumber(blocks);

        // Same length
        expect(result).toHaveLength(blocks.length);

        for (let k = 0; k < result.length; k++) {
          // Contiguous 1-based order
          expect(result[k]!.order).toBe(k + 1);
          // type and visible unchanged
          expect(result[k]!.type).toBe(blocks[k]!.type);
          expect(result[k]!.visible).toBe(blocks[k]!.visible);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: moveUp at boundary is identity
// ---------------------------------------------------------------------------

describe("Property 13: moveUp at boundary is identity", () => {
  it("moveUp(blocks, 0) returns identical list", () => {
    fc.assert(
      fc.property(blockListArbitrary, (blocks) => {
        const result = moveUp(blocks, 0);

        // Returns identical list (same reference)
        expect(result).toBe(blocks);
      }),
      { numRuns: 100 },
    );
  });

  it("moveUp(blocks, i) for i >= blocks.length returns input unchanged", () => {
    fc.assert(
      fc.property(
        blockListArbitrary,
        fc.integer({ min: 0, max: 50 }),
        (blocks, offset) => {
          const outOfBoundsIndex = blocks.length + offset;
          const result = moveUp(blocks, outOfBoundsIndex);

          // Returns identical list (same reference)
          expect(result).toBe(blocks);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 14: moveDown at boundary is identity
// ---------------------------------------------------------------------------

describe("Property 14: moveDown at boundary is identity", () => {
  it("moveDown(blocks, N-1) returns identical list", () => {
    fc.assert(
      fc.property(nonEmptyBlockListArbitrary, (blocks) => {
        const result = moveDown(blocks, blocks.length - 1);

        // Returns identical list (same reference)
        expect(result).toBe(blocks);
      }),
      { numRuns: 100 },
    );
  });

  it("moveDown(blocks, i) for i < 0 returns input unchanged", () => {
    fc.assert(
      fc.property(
        blockListArbitrary,
        fc.integer({ min: -50, max: -1 }),
        (blocks, negativeIndex) => {
          const result = moveDown(blocks, negativeIndex);

          // Returns identical list (same reference)
          expect(result).toBe(blocks);
        },
      ),
      { numRuns: 100 },
    );
  });
});
