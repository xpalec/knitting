/**
 * Property-based tests for pure validation utilities in lib/validation.ts.
 * Uses fast-check 4 with vitest as the test runner.
 *
 * File: apps/admin/src/__tests__/validation.property.test.ts
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  hasAtLeastOneCompleteLocale,
  requireField,
  requireBlockType,
  type LocaleEntry,
  type BlockLike,
  type WithBlocks,
} from '@/lib/validation';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a string that trims to non-empty (at least one non-whitespace char). */
const nonEmptyTrimmedString = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim() !== '');

/** Generates a string that trims to empty (all whitespace or empty). */
const emptyOrWhitespaceString = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constant('\t'),
  fc.constant('\n'),
  fc.constant('  \t  '),
);

/** Generates a LocaleEntry that is "complete" (both primary label and slug non-empty after trim). */
const completeLocaleEntry = fc.oneof(
  // title-based (Article / Entry shape)
  fc.record({
    title: nonEmptyTrimmedString,
    slug: nonEmptyTrimmedString,
  }),
  // name-based (Category shape)
  fc.record({
    name: nonEmptyTrimmedString,
    slug: nonEmptyTrimmedString,
  }),
) as fc.Arbitrary<LocaleEntry>;

/** Generates a LocaleEntry that is "incomplete" (primary label or slug is blank). */
const incompleteLocaleEntry: fc.Arbitrary<LocaleEntry> = fc.oneof(
  // empty title, non-empty slug
  fc.record({ title: emptyOrWhitespaceString, slug: nonEmptyTrimmedString }).map(
    (r): LocaleEntry => r,
  ),
  // non-empty title, empty slug
  fc.record({ title: nonEmptyTrimmedString, slug: emptyOrWhitespaceString }).map(
    (r): LocaleEntry => r,
  ),
  // both empty
  fc.record({ title: emptyOrWhitespaceString, slug: emptyOrWhitespaceString }).map(
    (r): LocaleEntry => r,
  ),
  // name-based: empty name, non-empty slug
  fc.record({ name: emptyOrWhitespaceString, slug: nonEmptyTrimmedString }).map(
    (r): LocaleEntry => r,
  ),
  // name-based: non-empty name, empty slug
  fc.record({ name: nonEmptyTrimmedString, slug: emptyOrWhitespaceString }).map(
    (r): LocaleEntry => r,
  ),
);

/** Generates a valid locale key (e.g. "en", "fr", "pt-BR"). */
const localeKey = fc
  .string({ minLength: 2, maxLength: 6 })
  .filter((s) => /^[a-z-]+$/.test(s));

// ---------------------------------------------------------------------------
// Property 1 — hasAtLeastOneCompleteLocale is an if-and-only-if condition
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 1: hasAtLeastOneCompleteLocale iff condition', () => {
  it('returns true when at least one entry has non-empty label AND non-empty slug', () => {
    /**
     * Validates: Requirements 1.2, 1.3
     *
     * For any record containing at least one complete locale entry,
     * hasAtLeastOneCompleteLocale must return true.
     */
    fc.assert(
      fc.property(
        // At least one complete entry
        fc.record({ key: localeKey, entry: completeLocaleEntry }),
        // Zero or more additional (possibly incomplete) entries
        fc.array(fc.record({ key: localeKey, entry: incompleteLocaleEntry }), {
          minLength: 0,
          maxLength: 4,
        }),
        ({ key, entry }, others) => {
          const locales: Record<string, LocaleEntry> = { [key]: entry };
          for (const { key: k, entry: e } of others) {
            if (k !== key) locales[k] = e;
          }
          expect(hasAtLeastOneCompleteLocale(locales)).toBe(true);
        },
      ),
    );
  });

  it('returns false when no entry has both non-empty label AND non-empty slug', () => {
    /**
     * Validates: Requirements 1.2, 1.3
     *
     * For any record containing only incomplete locale entries,
     * hasAtLeastOneCompleteLocale must return false.
     */
    fc.assert(
      fc.property(
        // One or more incomplete entries (at least one so the record is non-empty)
        fc.array(fc.record({ key: localeKey, entry: incompleteLocaleEntry }), {
          minLength: 1,
          maxLength: 5,
        }),
        (entries) => {
          const locales: Record<string, LocaleEntry> = {};
          for (const { key, entry } of entries) {
            locales[key] = entry;
          }
          expect(hasAtLeastOneCompleteLocale(locales)).toBe(false);
        },
      ),
    );
  });

  it('returns false for an empty record', () => {
    /**
     * Validates: Requirements 1.2, 1.3
     *
     * An empty locale record has no complete entry, so must return false.
     */
    expect(hasAtLeastOneCompleteLocale({})).toBe(false);
  });

  it('biconditional: result matches whether any entry is manually complete', () => {
    /**
     * Validates: Requirements 1.2, 1.3
     *
     * For any arbitrary locale record, the function result equals
     * Object.values(locales).some(e => (e.title ?? e.name ?? '').trim() !== '' && e.slug.trim() !== '').
     */
    const anyLocaleEntry: fc.Arbitrary<LocaleEntry> = fc.oneof(
      completeLocaleEntry,
      incompleteLocaleEntry,
    );

    fc.assert(
      fc.property(
        fc.dictionary(localeKey, anyLocaleEntry, { minKeys: 0, maxKeys: 6 }),
        (locales) => {
          const expected = Object.values(locales).some(
            (e) =>
              (e.title ?? e.name ?? '').trim() !== '' &&
              e.slug.trim() !== '',
          );
          expect(hasAtLeastOneCompleteLocale(locales)).toBe(expected);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 2 — hasAtLeastOneCompleteLocale is order-independent
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 2: hasAtLeastOneCompleteLocale order-independence', () => {
  it('produces the same result when key insertion order is shuffled', () => {
    /**
     * Validates: Requirements 1.5
     *
     * Creating a new object with the same key-value pairs in reversed insertion order
     * must produce the same boolean result as the original object.
     */
    const anyLocaleEntry: fc.Arbitrary<LocaleEntry> = fc.oneof(
      completeLocaleEntry,
      incompleteLocaleEntry,
    );

    fc.assert(
      fc.property(
        fc.dictionary(localeKey, anyLocaleEntry, { minKeys: 1, maxKeys: 6 }),
        (locales) => {
          // Build a reversed-insertion-order copy
          const entries = Object.entries(locales);
          const reversed: Record<string, LocaleEntry> = {};
          for (const [k, v] of [...entries].reverse()) {
            reversed[k] = v;
          }

          expect(hasAtLeastOneCompleteLocale(locales)).toBe(
            hasAtLeastOneCompleteLocale(reversed),
          );
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7 — requireField passes iff the field is truthy
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 7: requireField passes iff field is truthy', () => {
  it('returns null when values[fieldKey] is truthy', () => {
    /**
     * Validates: Requirements 8.7
     *
     * For any field key k and values object where v[k] is a non-empty string,
     * requireField(k)(v) must return null.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // field key
        fc.string({ minLength: 1, maxLength: 50 }), // truthy value
        (key, value) => {
          const rule = requireField<Record<string, unknown>>(key);
          expect(rule({ [key]: value })).toBeNull();
        },
      ),
    );
  });

  it('returns a non-empty string when values[fieldKey] is falsy', () => {
    /**
     * Validates: Requirements 8.7
     *
     * For any field key k and values where v[k] is falsy (empty string, null, undefined),
     * requireField(k)(v) must return a non-empty string.
     */
    const falsyValue = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined),
    );

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        falsyValue,
        (key, falsy) => {
          const rule = requireField<Record<string, unknown>>(key);
          const result = rule({ [key]: falsy });
          expect(typeof result).toBe('string');
          expect((result as string).length).toBeGreaterThan(0);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8 — requireField uses caller-supplied message
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 8: requireField uses caller-supplied message', () => {
  it('returns the exact supplied message when field is falsy and message is provided', () => {
    /**
     * Validates: Requirements 8.9
     *
     * For any non-empty message msg, field key k, and falsy field value,
     * requireField(k, msg)(v) === msg.
     */
    const falsyValue = fc.oneof(
      fc.constant(''),
      fc.constant(null),
      fc.constant(undefined),
    );

    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // key
        fc.string({ minLength: 1, maxLength: 100 }), // message
        falsyValue,
        (key, message, falsy) => {
          const rule = requireField<Record<string, unknown>>(key, message);
          expect(rule({ [key]: falsy })).toBe(message);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 — requireBlockType passes iff a visible block of that type exists
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 9: requireBlockType passes iff visible block exists', () => {
  it('returns null when at least one visible block of that type exists', () => {
    /**
     * Validates: Requirements 8.8
     *
     * For any block type t and blocks array containing at least one { type: t, visible: true },
     * requireBlockType(t)(values) must return null.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // blockType
        fc.array(
          fc.record({
            type: fc.string({ minLength: 1, maxLength: 20 }),
            visible: fc.boolean(),
          }),
          { minLength: 0, maxLength: 4 },
        ), // other blocks
        (blockType, otherBlocks) => {
          const matchingBlock: BlockLike = { type: blockType, visible: true };
          const values: WithBlocks = {
            blocks: [...otherBlocks, matchingBlock],
          };
          const rule = requireBlockType(blockType);
          expect(rule(values)).toBeNull();
        },
      ),
    );
  });

  it('returns a non-empty string when no visible block of that type exists', () => {
    /**
     * Validates: Requirements 8.8
     *
     * For any block type t and blocks array with no { type: t, visible: true },
     * requireBlockType(t)(values) must return a non-empty string.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // blockType to require
        fc.array(
          fc.record({
            type: fc.string({ minLength: 1, maxLength: 20 }),
            visible: fc.boolean(),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        (blockType, rawBlocks) => {
          // Ensure no block satisfies type===blockType && visible===true
          const blocks: BlockLike[] = rawBlocks.map((b) =>
            b.type === blockType ? { ...b, visible: false } : b,
          );
          const values: WithBlocks = { blocks };
          const rule = requireBlockType(blockType);
          const result = rule(values);
          expect(typeof result).toBe('string');
          expect((result as string).length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('biconditional: result is null iff a visible matching block exists', () => {
    /**
     * Validates: Requirements 8.8
     *
     * The result of requireBlockType(t)(values) is null exactly when
     * values.blocks.some(b => b.type === t && b.visible === true).
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(
          fc.record({
            type: fc.string({ minLength: 1, maxLength: 20 }),
            visible: fc.boolean(),
          }),
          { minLength: 0, maxLength: 6 },
        ),
        (blockType, blocks) => {
          const values: WithBlocks = { blocks };
          const rule = requireBlockType(blockType);
          const hasVisibleMatch = blocks.some(
            (b) => b.type === blockType && b.visible === true,
          );
          if (hasVisibleMatch) {
            expect(rule(values)).toBeNull();
          } else {
            const result = rule(values);
            expect(typeof result).toBe('string');
            expect((result as string).length).toBeGreaterThan(0);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10 — requireBlockType uses caller-supplied message
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 10: requireBlockType uses caller-supplied message', () => {
  it('returns the exact supplied message when no visible block of that type exists', () => {
    /**
     * Validates: Requirements 8.9
     *
     * For any non-empty message msg, block type t, and blocks with no visible match,
     * requireBlockType(t, msg)(values) === msg.
     */
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // blockType
        fc.string({ minLength: 1, maxLength: 100 }), // message
        fc.array(
          fc.record({
            type: fc.string({ minLength: 1, maxLength: 20 }),
            visible: fc.boolean(),
          }),
          { minLength: 0, maxLength: 5 },
        ),
        (blockType, message, rawBlocks) => {
          // Ensure no visible block of the required type
          const blocks: BlockLike[] = rawBlocks.map((b) =>
            b.type === blockType ? { ...b, visible: false } : b,
          );
          const values: WithBlocks = { blocks };
          const rule = requireBlockType(blockType, message);
          expect(rule(values)).toBe(message);
        },
      ),
    );
  });
});
