/**
 * Property-based tests for component-level behaviour across
 * ArticleEditorForm, EntryForm, and CategoryForm.
 *
 * Properties covered:
 *   3  – Tab indicator colour matches locale completeness
 *   4  – Inline slug helper visibility matches title-without-slug condition
 *   5  – Submit buttons disabled exactly when no locale is complete (not submitting)
 *   6  – isSubmitting=true disables all save actions regardless of locale state
 *  11  – ValidationSummary renders all failing rule messages
 *  12  – ValidationSummary is absent when all rules pass and locale is complete
 *
 * File: apps/admin/src/__tests__/forms.property.test.tsx
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must come before component imports)
// ---------------------------------------------------------------------------

vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: () => null,
}));

vi.mock('@/components/articles/cover-image-upload', () => ({
  CoverImageUpload: () => null,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

import {
  ArticleEditorForm,
  type ArticleLocaleTabState,
  type ArticleEditorFormValues,
} from '@/components/articles/article-editor-form';
import {
  EntryForm,
  type LocaleTabState as EntryLocaleTabState,
  type EntryFormValues,
  SUPPORTED_LOCALES as ENTRY_SUPPORTED_LOCALES,
} from '@/components/entries/entry-form';
import {
  CategoryForm,
  type LocaleTabState as CategoryLocaleTabState,
  SUPPORTED_LOCALES as CATEGORY_SUPPORTED_LOCALES,
} from '@/components/categories/category-form';

import { ARTICLE_SUPPORTED_LOCALES, ARTICLE_LOCALE_LABELS } from '@/lib/api/articles';
import type { ArticleLocale } from '@/lib/api/articles';
import type { ValidationRule } from '@/lib/validation';

// ---------------------------------------------------------------------------
// fast-check configuration: keep iterations low for component-render tests
// so the suite finishes well within the 60-second per-test timeout.
// ---------------------------------------------------------------------------
const FC_OPTS: fc.Parameters<unknown> = { numRuns: 5 };

// ---------------------------------------------------------------------------
// Helper: render a component inside a fresh QueryClientProvider.
// EntryForm transitively uses useQueryClient (via TagsPanel → TagCreateDialog
// and RelationshipsPanel), so it must be wrapped.
// ---------------------------------------------------------------------------
function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Locale label maps (needed for tab-trigger queries)
// ---------------------------------------------------------------------------

const ENTRY_LOCALE_LABELS: Record<(typeof ENTRY_SUPPORTED_LOCALES)[number], string> = {
  en: 'English',
  pl: 'Polish',
  fr: 'French',
  de: 'German',
};

const CATEGORY_LOCALE_LABELS: Record<(typeof CATEGORY_SUPPORTED_LOCALES)[number], string> = {
  en: 'English',
  pl: 'Polish',
  fr: 'French',
  de: 'German',
  no: 'Norwegian',
};

// ---------------------------------------------------------------------------
// Shared arbitraries
// ---------------------------------------------------------------------------

/** Non-empty string that trims to non-empty. */
const nonEmptyTrimmed = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim() !== '');

/** String that trims to empty (all whitespace or empty). */
const emptyOrWhitespace = fc.oneof(
  fc.constant(''),
  fc.constant('  '),
  fc.constant('\t'),
);

// ---------------------------------------------------------------------------
// Locale state factories
// ---------------------------------------------------------------------------

function articleLocaleState(title: string, slug: string): ArticleLocaleTabState {
  return {
    title,
    slug,
    slugManuallyEdited: true,
    shortDescription: '',
    seoTitle: '',
    seoDescription: '',
  };
}

function entryLocaleState(title: string, slug: string): EntryLocaleTabState {
  return {
    title,
    slug,
    slugManuallyEdited: true,
    shortDescription: '',
    seoTitle: '',
    seoDescription: '',
    synonyms: [],
    translationStatus: 'draft',
    blocks: [],
  };
}

function categoryLocaleState(name: string, slug: string): CategoryLocaleTabState {
  return {
    name,
    slug,
    slugManuallyEdited: true,
    short_description: '',
    description: null,
    seo_title: '',
    seo_description: '',
    status: 'draft',
  };
}

// ---------------------------------------------------------------------------
// Helpers: build full locale records
// ---------------------------------------------------------------------------

function buildArticleLocales(
  targetLocale: ArticleLocale,
  title: string,
  slug: string,
): Record<ArticleLocale, ArticleLocaleTabState> {
  const result = {} as Record<ArticleLocale, ArticleLocaleTabState>;
  for (const locale of ARTICLE_SUPPORTED_LOCALES) {
    result[locale] =
      locale === targetLocale
        ? articleLocaleState(title, slug)
        : articleLocaleState('', '');
  }
  return result;
}

function buildEntryLocales(
  targetLocale: (typeof ENTRY_SUPPORTED_LOCALES)[number],
  title: string,
  slug: string,
): Record<(typeof ENTRY_SUPPORTED_LOCALES)[number], EntryLocaleTabState> {
  const result = {} as Record<(typeof ENTRY_SUPPORTED_LOCALES)[number], EntryLocaleTabState>;
  for (const locale of ENTRY_SUPPORTED_LOCALES) {
    result[locale] =
      locale === targetLocale
        ? entryLocaleState(title, slug)
        : entryLocaleState('', '');
  }
  return result;
}

function buildCategoryLocales(
  targetLocale: (typeof CATEGORY_SUPPORTED_LOCALES)[number],
  name: string,
  slug: string,
): Record<(typeof CATEGORY_SUPPORTED_LOCALES)[number], CategoryLocaleTabState> {
  const result = {} as Record<
    (typeof CATEGORY_SUPPORTED_LOCALES)[number],
    CategoryLocaleTabState
  >;
  for (const locale of CATEGORY_SUPPORTED_LOCALES) {
    result[locale] =
      locale === targetLocale
        ? categoryLocaleState(name, slug)
        : categoryLocaleState('', '');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper: find the dot span inside a tab trigger by locale label
// ---------------------------------------------------------------------------

function getDotSpanForLocale(tabLabel: string): Element | null {
  // Radix Tabs.Trigger renders role="tab"; the dot is the first
  // span[aria-hidden="true"] inside the button.
  const tabButton = screen.queryByRole('tab', { name: tabLabel });
  if (!tabButton) return null;
  return tabButton.querySelector('span[aria-hidden="true"]');
}

// ---------------------------------------------------------------------------
// Property 3 – Tab indicator colour matches locale completeness
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 3: Tab indicator color matches locale completeness', () => {
  /**
   * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
   *
   * For any locale state, the tab indicator dot has `bg-green-500`
   * iff both primary label (title/name) and slug are non-empty after trim —
   * tested across all three form components.
   */

  // ── ArticleEditorForm ──────────────────────────────────────────────────

  it('[ArticleEditorForm] dot is bg-green-500 when title AND slug are non-empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARTICLE_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, title, slug) => {
          const locales = buildArticleLocales(targetLocale, title, slug);
          const { unmount } = render(
            <ArticleEditorForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
          );

          const dot = getDotSpanForLocale(ARTICLE_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(true);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[ArticleEditorForm] dot is NOT bg-green-500 when title is empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARTICLE_SUPPORTED_LOCALES),
        emptyOrWhitespace,
        nonEmptyTrimmed,
        (targetLocale, emptyTitle, slug) => {
          const locales = buildArticleLocales(targetLocale, emptyTitle, slug);
          const { unmount } = render(
            <ArticleEditorForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
          );

          const dot = getDotSpanForLocale(ARTICLE_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(false);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[ArticleEditorForm] dot is NOT bg-green-500 when slug is empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARTICLE_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        emptyOrWhitespace,
        (targetLocale, title, emptySlug) => {
          const locales = buildArticleLocales(targetLocale, title, emptySlug);
          const { unmount } = render(
            <ArticleEditorForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
          );

          const dot = getDotSpanForLocale(ARTICLE_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(false);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  // ── EntryForm ──────────────────────────────────────────────────────────

  it('[EntryForm] dot is bg-green-500 when title AND slug are non-empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ENTRY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, title, slug) => {
          const locales = buildEntryLocales(targetLocale, title, slug);
          const { unmount } = renderWithQueryClient(
            <EntryForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
          );

          const dot = getDotSpanForLocale(ENTRY_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(true);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[EntryForm] dot is NOT bg-green-500 when title is empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ENTRY_SUPPORTED_LOCALES),
        emptyOrWhitespace,
        nonEmptyTrimmed,
        (targetLocale, emptyTitle, slug) => {
          const locales = buildEntryLocales(targetLocale, emptyTitle, slug);
          const { unmount } = renderWithQueryClient(
            <EntryForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
          );

          const dot = getDotSpanForLocale(ENTRY_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(false);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[EntryForm] dot is NOT bg-green-500 when slug is empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ENTRY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        emptyOrWhitespace,
        (targetLocale, title, emptySlug) => {
          const locales = buildEntryLocales(targetLocale, title, emptySlug);
          const { unmount } = renderWithQueryClient(
            <EntryForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
          );

          const dot = getDotSpanForLocale(ENTRY_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(false);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  // ── CategoryForm ───────────────────────────────────────────────────────

  it('[CategoryForm] dot is bg-green-500 when name AND slug are non-empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CATEGORY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, name, slug) => {
          const locales = buildCategoryLocales(targetLocale, name, slug);
          const { unmount } = render(
            <CategoryForm
              onSubmit={vi.fn()}
              defaultValues={{ locales, type: 'entry' }}
            />,
          );

          const dot = getDotSpanForLocale(CATEGORY_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(true);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[CategoryForm] dot is NOT bg-green-500 when name is empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CATEGORY_SUPPORTED_LOCALES),
        emptyOrWhitespace,
        nonEmptyTrimmed,
        (targetLocale, emptyName, slug) => {
          const locales = buildCategoryLocales(targetLocale, emptyName, slug);
          const { unmount } = render(
            <CategoryForm
              onSubmit={vi.fn()}
              defaultValues={{ locales, type: 'entry' }}
            />,
          );

          const dot = getDotSpanForLocale(CATEGORY_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(false);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[CategoryForm] dot is NOT bg-green-500 when slug is empty', { timeout: 60_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CATEGORY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        emptyOrWhitespace,
        (targetLocale, name, emptySlug) => {
          const locales = buildCategoryLocales(targetLocale, name, emptySlug);
          const { unmount } = render(
            <CategoryForm
              onSubmit={vi.fn()}
              defaultValues={{ locales, type: 'entry' }}
            />,
          );

          const dot = getDotSpanForLocale(CATEGORY_LOCALE_LABELS[targetLocale]);
          expect(dot?.classList.contains('bg-green-500')).toBe(false);

          unmount();
        },
      ),
      FC_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4 – Inline slug helper visibility matches title-without-slug condition
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 4: Inline slug helper visibility matches title-without-slug condition', () => {
  /**
   * Validates: Requirements 6.1, 6.2, 6.3
   *
   * The helper <p> is in the DOM iff the primary label is non-empty
   * and the slug is empty after trimming.
   *
   * We always test the English locale tab since only the active tab's content
   * is rendered in the DOM (Radix Tabs hides inactive tabs).
   * "en" is the default tab value in all three forms.
   */

  const HELPER_TEXT = 'Add a slug to make this locale complete.';

  // ── ArticleEditorForm ──────────────────────────────────────────────────

  it('[ArticleEditorForm] helper is visible when title non-empty and slug empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyTrimmed, (title) => {
        const locales = buildArticleLocales('en', title, '');
        const { unmount } = render(
          <ArticleEditorForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
        );
        expect(screen.queryByText(HELPER_TEXT)).toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[ArticleEditorForm] helper is absent when slug is non-empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyTrimmed, nonEmptyTrimmed, (title, slug) => {
        const locales = buildArticleLocales('en', title, slug);
        const { unmount } = render(
          <ArticleEditorForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
        );
        expect(screen.queryByText(HELPER_TEXT)).not.toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[ArticleEditorForm] helper is absent when title is empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, (emptyTitle) => {
        const locales = buildArticleLocales('en', emptyTitle, '');
        const { unmount } = render(
          <ArticleEditorForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
        );
        expect(screen.queryByText(HELPER_TEXT)).not.toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  // ── EntryForm ──────────────────────────────────────────────────────────

  it('[EntryForm] helper is visible when title non-empty and slug empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyTrimmed, (title) => {
        const locales = buildEntryLocales('en', title, '');
        const { unmount } = renderWithQueryClient(
          <EntryForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
        );
        expect(screen.queryByText(HELPER_TEXT)).toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[EntryForm] helper is absent when slug is non-empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyTrimmed, nonEmptyTrimmed, (title, slug) => {
        const locales = buildEntryLocales('en', title, slug);
        const { unmount } = renderWithQueryClient(
          <EntryForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
        );
        expect(screen.queryByText(HELPER_TEXT)).not.toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[EntryForm] helper is absent when title is empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, (emptyTitle) => {
        const locales = buildEntryLocales('en', emptyTitle, '');
        const { unmount } = renderWithQueryClient(
          <EntryForm onSubmit={vi.fn()} defaultValues={{ locales }} />,
        );
        expect(screen.queryByText(HELPER_TEXT)).not.toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  // ── CategoryForm ───────────────────────────────────────────────────────

  it('[CategoryForm] helper is visible when name non-empty and slug empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyTrimmed, (name) => {
        const locales = buildCategoryLocales('en', name, '');
        const { unmount } = render(
          <CategoryForm
            onSubmit={vi.fn()}
            defaultValues={{ locales, type: 'entry' }}
          />,
        );
        expect(screen.queryByText(HELPER_TEXT)).toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[CategoryForm] helper is absent when slug is non-empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyTrimmed, nonEmptyTrimmed, (name, slug) => {
        const locales = buildCategoryLocales('en', name, slug);
        const { unmount } = render(
          <CategoryForm
            onSubmit={vi.fn()}
            defaultValues={{ locales, type: 'entry' }}
          />,
        );
        expect(screen.queryByText(HELPER_TEXT)).not.toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[CategoryForm] helper is absent when name is empty', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, (emptyName) => {
        const locales = buildCategoryLocales('en', emptyName, '');
        const { unmount } = render(
          <CategoryForm
            onSubmit={vi.fn()}
            defaultValues={{ locales, type: 'entry' }}
          />,
        );
        expect(screen.queryByText(HELPER_TEXT)).not.toBeInTheDocument();
        unmount();
      }),
      FC_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5 – Submit buttons disabled exactly when no locale is complete
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 5: Submit buttons disabled exactly when no locale is complete (and not submitting)', () => {
  /**
   * Validates: Requirements 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 7.1, 7.2
   *
   * For isSubmitting=false and no validationRules, both Publish and Save Draft
   * are disabled iff hasAtLeastOneCompleteLocale(locales) is false.
   */

  it('[ArticleEditorForm] Publish and Save Draft are disabled when no locale is complete', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, emptyOrWhitespace, (title, slug) => {
        const locales = buildArticleLocales('en', title, slug);
        const { unmount } = render(
          <ArticleEditorForm
            onSubmit={vi.fn()}
            onSaveDraft={vi.fn()}
            isSubmitting={false}
            defaultValues={{ locales }}
          />,
        );

        expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();

        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[ArticleEditorForm] Publish and Save Draft are enabled when at least one locale is complete', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARTICLE_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, title, slug) => {
          const locales = buildArticleLocales(targetLocale, title, slug);
          const { unmount } = render(
            <ArticleEditorForm
              onSubmit={vi.fn()}
              onSaveDraft={vi.fn()}
              isSubmitting={false}
              defaultValues={{ locales }}
            />,
          );

          expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled();
          expect(screen.getByRole('button', { name: /save draft/i })).not.toBeDisabled();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[EntryForm] Publish and Save Draft are disabled when no locale is complete', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, emptyOrWhitespace, (title, slug) => {
        const locales = buildEntryLocales('en', title, slug);
        const { container, unmount } = renderWithQueryClient(
          <EntryForm
            onSubmit={vi.fn()}
            isSubmitting={false}
            defaultValues={{ locales }}
          />,
        );

        // EntryForm has a single submit button; it is disabled when no locale is complete.
        expect(container.querySelector('button[disabled][class*="bg-violet-600"]')).not.toBeNull();

        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[EntryForm] Publish and Save Draft are enabled when at least one locale is complete', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ENTRY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, title, slug) => {
          const locales = buildEntryLocales(targetLocale, title, slug);
          const { container, unmount } = renderWithQueryClient(
            <EntryForm
              onSubmit={vi.fn()}
              isSubmitting={false}
              defaultValues={{ locales }}
            />,
          );

          // When a locale is complete the Publish button is enabled.
          const publishBtn = container.querySelector('button[class*="bg-violet-600"]');
          expect(publishBtn).not.toBeNull();
          expect(publishBtn).not.toBeDisabled();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6 – isSubmitting=true disables all save actions regardless of locale
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 6: isSubmitting=true disables all save actions regardless of locale state', () => {
  /**
   * Validates: Requirements 7.3, 7.4
   *
   * When isSubmitting is true, both Publish and Save Draft are disabled
   * regardless of locale completeness or validationRules.
   *
   * When isSubmitting=true the button labels change to "Publishing…" / "Saving…".
   */

  it('[ArticleEditorForm] both buttons disabled when isSubmitting=true, with complete locale', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARTICLE_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, title, slug) => {
          const locales = buildArticleLocales(targetLocale, title, slug);
          const { unmount } = render(
            <ArticleEditorForm
              onSubmit={vi.fn()}
              onSaveDraft={vi.fn()}
              isSubmitting={true}
              defaultValues={{ locales }}
            />,
          );

          expect(screen.getByRole('button', { name: /publishing…/i })).toBeDisabled();
          expect(screen.getByRole('button', { name: /saving…/i })).toBeDisabled();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[ArticleEditorForm] both buttons disabled when isSubmitting=true, with no complete locale', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, emptyOrWhitespace, (title, slug) => {
        const locales = buildArticleLocales('en', title, slug);
        const { unmount } = render(
          <ArticleEditorForm
            onSubmit={vi.fn()}
            onSaveDraft={vi.fn()}
            isSubmitting={true}
            defaultValues={{ locales }}
          />,
        );

        expect(screen.getByRole('button', { name: /publishing…/i })).toBeDisabled();
        expect(screen.getByRole('button', { name: /saving…/i })).toBeDisabled();

        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[EntryForm] both buttons disabled when isSubmitting=true, with complete locale', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ENTRY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, title, slug) => {
          const locales = buildEntryLocales(targetLocale, title, slug);
          const { container, unmount } = renderWithQueryClient(
            <EntryForm
              onSubmit={vi.fn()}
              isSubmitting={true}
              defaultValues={{ locales }}
            />,
          );

          // EntryForm has a single submit button showing "Publishing…" when isSubmitting=true
          // and no entryId (new entry). It must be disabled while submitting.
          const publishingBtn = container.querySelector('button[class*="bg-violet-600"]');
          expect(publishingBtn).not.toBeNull();
          expect(publishingBtn).toBeDisabled();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[EntryForm] both buttons disabled when isSubmitting=true, with no complete locale', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(emptyOrWhitespace, emptyOrWhitespace, (title, slug) => {
        const locales = buildEntryLocales('en', title, slug);
        const { container, unmount } = renderWithQueryClient(
          <EntryForm
            onSubmit={vi.fn()}
            isSubmitting={true}
            defaultValues={{ locales }}
          />,
        );

        // Submit button is disabled when isSubmitting=true regardless of locale completeness.
        const publishingBtn = container.querySelector('button[class*="bg-violet-600"]');
        expect(publishingBtn).not.toBeNull();
        expect(publishingBtn).toBeDisabled();

        unmount();
      }),
      FC_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11 – ValidationSummary renders all failing rule messages
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 11: ValidationSummary renders all failing rule messages', () => {
  /**
   * Validates: Requirements 9.1, 9.5
   *
   * For any non-empty list of failing ValidationRules, the rendered form
   * contains one visible list item per failing rule — none are omitted.
   *
   * We use a complete locale so that only rule errors appear, making it
   * straightforward to count list items.
   */

  // Non-empty array of distinct non-empty error message strings.
  const nonEmptyErrorMessages = fc
    .array(
      fc.string({ minLength: 5, maxLength: 50 }).filter((s) => s.trim() !== ''),
      { minLength: 1, maxLength: 4 },
    )
    .map((msgs) => [...new Set(msgs)])
    .filter((msgs) => msgs.length > 0);

  function buildFailingRules<T>(messages: string[]): ValidationRule<T>[] {
    return messages.map((msg) => () => msg);
  }

  it('[ArticleEditorForm] ValidationSummary has one list item per failing rule', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyErrorMessages, (errorMessages) => {
        const locales = buildArticleLocales('en', 'My article', 'my-article');
        const rules = buildFailingRules<ArticleEditorFormValues>(errorMessages);

        const { container, unmount } = render(
          <ArticleEditorForm
            onSubmit={vi.fn()}
            isSubmitting={false}
            defaultValues={{ locales }}
            validationRules={rules}
          />,
        );

        // Use container-scoped query to avoid cross-iteration pollution
        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        const items = alert!.querySelectorAll('li');
        expect(items.length).toBe(errorMessages.length);

        for (const msg of errorMessages) {
          expect(alert!.textContent).toContain(msg);
        }

        unmount();
      }),
      FC_OPTS,
    );
  });

  it('[EntryForm] ValidationSummary has one list item per failing rule', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(nonEmptyErrorMessages, (errorMessages) => {
        const locales = buildEntryLocales('en', 'My entry', 'my-entry');
        const rules = buildFailingRules<EntryFormValues>(errorMessages);

        const { container, unmount } = renderWithQueryClient(
          <EntryForm
            onSubmit={vi.fn()}
            isSubmitting={false}
            defaultValues={{ locales }}
            validationRules={rules}
          />,
        );

        // Use container-scoped query to avoid cross-iteration pollution
        const alert = container.querySelector('[role="alert"]');
        expect(alert).not.toBeNull();
        const items = alert!.querySelectorAll('li');
        expect(items.length).toBe(errorMessages.length);

        for (const msg of errorMessages) {
          expect(alert!.textContent).toContain(msg);
        }

        unmount();
      }),
      FC_OPTS,
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12 – ValidationSummary is absent when all rules pass and locale complete
// ---------------------------------------------------------------------------

describe('Feature: multilingual-content-validation, Property 12: ValidationSummary is absent when all rules pass and locale is complete', () => {
  /**
   * Validates: Requirements 9.3
   *
   * When hasAtLeastOneCompleteLocale returns true AND all validationRules
   * return null, the ValidationSummary element (role="alert") is not in the DOM.
   */

  const passingRuleCount = fc.integer({ min: 0, max: 4 });

  function buildPassingRules<T>(count: number): ValidationRule<T>[] {
    return Array.from({ length: count }, () => () => null);
  }

  it('[ArticleEditorForm] ValidationSummary absent when locale complete and all rules pass', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ARTICLE_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        passingRuleCount,
        (targetLocale, title, slug, ruleCount) => {
          const locales = buildArticleLocales(targetLocale, title, slug);
          const rules = buildPassingRules<ArticleEditorFormValues>(ruleCount);

          const { unmount } = render(
            <ArticleEditorForm
              onSubmit={vi.fn()}
              isSubmitting={false}
              defaultValues={{ locales }}
              validationRules={rules}
            />,
          );

          expect(screen.queryByRole('alert')).not.toBeInTheDocument();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[EntryForm] ValidationSummary absent when locale complete and all rules pass', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ENTRY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        passingRuleCount,
        (targetLocale, title, slug, ruleCount) => {
          const locales = buildEntryLocales(targetLocale, title, slug);
          const rules = buildPassingRules<EntryFormValues>(ruleCount);

          const { unmount } = renderWithQueryClient(
            <EntryForm
              onSubmit={vi.fn()}
              isSubmitting={false}
              defaultValues={{ locales }}
              validationRules={rules}
            />,
          );

          expect(screen.queryByRole('alert')).not.toBeInTheDocument();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });

  it('[CategoryForm] ValidationSummary absent when locale complete (no validationRules prop)', { timeout: 30_000 }, () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...CATEGORY_SUPPORTED_LOCALES),
        nonEmptyTrimmed,
        nonEmptyTrimmed,
        (targetLocale, name, slug) => {
          const locales = buildCategoryLocales(targetLocale, name, slug);

          const { unmount } = render(
            <CategoryForm
              onSubmit={vi.fn()}
              isSubmitting={false}
              defaultValues={{ locales, type: 'entry' }}
            />,
          );

          expect(screen.queryByRole('alert')).not.toBeInTheDocument();

          unmount();
        },
      ),
      FC_OPTS,
    );
  });
});
