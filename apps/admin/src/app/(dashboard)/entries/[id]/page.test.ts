import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mapEntryToFormValues } from './page';

// ---------------------------------------------------------------------------
// Task 1 — Bug condition exploration (MUST FAIL on unfixed code)
// **Validates: Requirements 1.2, 2.1, 2.2**
// ---------------------------------------------------------------------------

describe('mapEntryToFormValues - bug condition', () => {
  it('should populate blocks for untranslated locale when entry has a template (Property 1: Bug Condition)', () => {
    const blockArb = fc.record({
      id: fc.uuid(),
      type: fc.constantFrom('text', 'image', 'quote'),
      label: fc.string({ minLength: 1, maxLength: 20 }),
      order: fc.integer({ min: 0, max: 9 }),
      required: fc.boolean(),
    });

    const entryArb = fc.record({
      id: fc.uuid(),
      term: fc.string(),
      origin_language: fc.constant('en'),
      status: fc.constantFrom('draft', 'published'),
      entry_template_id: fc.uuid(),
      entry_template: fc.record({
        id: fc.uuid(),
        blocks: fc.array(blockArb, { minLength: 1, maxLength: 5 }),
        translations: fc.constant({}),
      }),
      translations: fc.constant([{
        locale: 'en',
        term: 'hello',
        slug: 'hello',
        blocks: {},
        metadata: {},
      }]),
      tags: fc.constant([]),
      category_id: fc.constant(null),
      entry_abbreviations: fc.constant([]),
    });

    fc.assert(
      fc.property(entryArb, (entry) => {
        const result = mapEntryToFormValues(entry as any, ['en', 'pl']);
        const plLocale = result.locales['pl' as any];
        expect(plLocale).toBeDefined();
        expect(plLocale!.blocks.length).toBe(entry.entry_template!.blocks.length);
        expect(plLocale!.title).toBe('');
        expect(plLocale!.slug).toBe('');
      }),
      { numRuns: 20 }
    );
  });
});

// ---------------------------------------------------------------------------
// Task 2 — Preservation tests (MUST PASS on unfixed code)
// **Validates: Requirements 3.1, 3.2**
// ---------------------------------------------------------------------------

describe('mapEntryToFormValues - preservation', () => {
  it('preserves translated locale data (Property 2: Preservation)', () => {
    const blockArb = fc.record({
      id: fc.uuid(),
      type: fc.constant('text'),
      label: fc.string({ minLength: 1, maxLength: 10 }),
      order: fc.integer({ min: 0, max: 4 }),
      required: fc.boolean(),
    });

    const entryWithTranslationArb = fc.record({
      id: fc.uuid(),
      term: fc.string(),
      origin_language: fc.constant('en'),
      status: fc.constantFrom('draft', 'published'),
      entry_template_id: fc.uuid(),
      entry_template: fc.record({
        id: fc.uuid(),
        blocks: fc.array(blockArb, { minLength: 1, maxLength: 3 }),
        translations: fc.constant({}),
      }),
      translations: fc.tuple(
        fc.record({
          locale: fc.constant('en'),
          term: fc.string({ minLength: 1, maxLength: 30 }),
          slug: fc.string({ minLength: 1, maxLength: 30 }),
          blocks: fc.constant({}),
          metadata: fc.constant({}),
        })
      ).map(([t]) => [t]),
      tags: fc.constant([]),
      category_id: fc.constant(null),
      entry_abbreviations: fc.constant([]),
    });

    fc.assert(
      fc.property(entryWithTranslationArb, (entry) => {
        const result = mapEntryToFormValues(entry as any);
        const enLocale = result.locales['en' as any];
        const translation = entry.translations[0]!;
        expect(enLocale).toBeDefined();
        expect(enLocale!.title).toBe(translation.term);
        expect(enLocale!.slug).toBe(translation.slug);
        expect(enLocale!.blocks.length).toBe(entry.entry_template!.blocks.length);
      }),
      { numRuns: 20 }
    );
  });

  it('produces empty blocks for entries with no template (Property 2: No-template preservation)', () => {
    const entryNoTemplateArb = fc.record({
      id: fc.uuid(),
      term: fc.string(),
      origin_language: fc.constant('en'),
      status: fc.constantFrom('draft', 'published'),
      entry_template_id: fc.constant(null),
      entry_template: fc.constant(null),
      translations: fc.array(fc.record({
        locale: fc.constantFrom('en', 'pl', 'fr'),
        term: fc.string(),
        slug: fc.string(),
        blocks: fc.constant({}),
        metadata: fc.constant({}),
      }), { minLength: 0, maxLength: 3 }),
      tags: fc.constant([]),
      category_id: fc.constant(null),
      entry_abbreviations: fc.constant([]),
    });

    fc.assert(
      fc.property(entryNoTemplateArb, (entry) => {
        const result = mapEntryToFormValues(entry as any);
        for (const locale of Object.keys(result.locales)) {
          expect(result.locales[locale as any]!.blocks).toEqual([]);
        }
      }),
      { numRuns: 20 }
    );
  });
});
