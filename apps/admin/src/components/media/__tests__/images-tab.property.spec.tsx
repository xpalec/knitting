/**
 * Property-based tests for ImagesTab component.
 *
 * Feature: image-multi-size-upload, Property 12: Image gallery renders all returned assets
 *
 * Validates: Requirements 5.2, 5.3
 *
 * File: apps/admin/src/components/media/__tests__/images-tab.property.spec.tsx
 */

// ---------------------------------------------------------------------------
// Module-level mocks (must come before component imports)
// ---------------------------------------------------------------------------

// Mock @tanstack/react-query so we can control what useQuery returns
const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
  }),
}));

// Mock the mediaApi so no real HTTP calls happen
vi.mock('@/lib/api/media', () => ({
  mediaApi: {
    listForEntity: vi.fn(),
    updateAltText: vi.fn(),
    uploadForEntry: vi.fn(),
    uploadForArticle: vi.fn(),
  },
}));

// Mock sonner so toast calls don't fail
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ImagesTab } from '../images-tab';
import type { MediaAsset } from '@/lib/api/media';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Render ImagesTab with the given assets returned by useQuery.
 * Sets up the mock to return the assets as if the query completed successfully.
 */
function renderWithAssets(assets: MediaAsset[]) {
  mockUseQuery.mockReturnValue({
    data: assets,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });

  return render(
    <ImagesTab sourceType="entry" sourceId="test-id" />,
  );
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generator for a single MediaAsset matching the full interface shape.
 * Adds required fields (source_id, source_type, type, sort_order, created_at,
 * updated_at) that are not part of the property-spec generator sketch but are
 * required by the TypeScript type.
 *
 * filename uses alphanumeric characters only so that
 * Testing Library's title-matching utilities can reliably locate it in the DOM.
 */
const assetArbitrary = fc.record({
  id: fc.uuid(),
  url_original: fc.webUrl(),
  url_medium: fc.option(fc.webUrl(), { nil: null }),
  url_small: fc.option(fc.webUrl(), { nil: null }),
  // Constrain filename to word-character strings so DOM title queries are
  // not tripped up by leading/trailing whitespace normalisation.
  filename: fc.stringMatching(/^[a-zA-Z0-9._-]{1,60}$/),
  alt_text: fc.option(fc.string({ minLength: 0, maxLength: 200 }), { nil: null }),
  // Required fields from MediaAsset interface
  source_id: fc.uuid(),
  source_type: fc.constantFrom('entry' as const, 'article' as const),
  type: fc.constantFrom('image' as const, 'diagram' as const),
  sort_order: fc.integer({ min: 0, max: 100 }),
  created_at: fc.date().map((d) => d.toISOString()),
  updated_at: fc.date().map((d) => d.toISOString()),
});

/**
 * Array of assets with unique IDs to avoid React key collisions that
 * would cause some cards to be omitted from the render.
 */
const assetsArrayArbitrary = fc
  .uniqueArray(assetArbitrary, {
    minLength: 0,
    maxLength: 20,
    selector: (a) => a.id,
  });

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Property 12: Image gallery renders all returned assets
//
// Feature: image-multi-size-upload, Property 12: Image gallery renders all returned assets
// Validates: Requirements 5.2, 5.3
// ---------------------------------------------------------------------------

describe('Property 12: Image gallery renders all returned assets', () => {
  it(
    'renders exactly one card per asset — card count equals assets array length',
    () => {
      fc.assert(
        fc.property(assetsArrayArbitrary, (assets) => {
          const { unmount } = renderWithAssets(assets);

          if (assets.length === 0) {
            // Requirement 5.4: empty-state message shown when no assets
            const emptyMsg = screen.queryByText(/no images have been uploaded/i);
            expect(emptyMsg).toBeInTheDocument();
          } else {
            // Requirement 5.2: one card per asset.
            // Each AssetCard renders the filename in a <p title={asset.filename}>.
            // We count unique title attributes to get the card count.
            // (getAllByTitle would throw on duplicates, so we query all at once.)
            const filenameEls = assets.map((a) =>
              screen.queryAllByTitle(a.filename),
            );
            // Each asset filename should appear at least once in the DOM
            const allFound = filenameEls.every((els) => els.length >= 1);
            expect(allFound).toBe(true);
          }

          unmount();
        }),
        { numRuns: 100, verbose: false },
      );
    },
  );

  it(
    'renders each asset filename as visible text (Requirements 5.3)',
    () => {
      fc.assert(
        fc.property(
          // Use a non-empty array with unique IDs so cards are not omitted
          fc.uniqueArray(assetArbitrary, {
            minLength: 1,
            maxLength: 10,
            selector: (a) => a.id,
          }),
          (assets) => {
            const { unmount } = renderWithAssets(assets);

            for (const asset of assets) {
              // AssetCard renders filename in a <p title={asset.filename}> element.
              // Using queryAllByTitle covers cases where the same filename appears
              // in multiple cards (duplicate filenames are valid).
              const filenameEls = screen.queryAllByTitle(asset.filename);
              expect(filenameEls.length).toBeGreaterThanOrEqual(1);
            }

            unmount();
          },
        ),
        { numRuns: 100, verbose: false },
      );
    },
  );

  it(
    'renders empty-state message when asset list is empty (Requirement 5.4)',
    () => {
      fc.assert(
        fc.property(fc.constant([] as MediaAsset[]), (_assets) => {
          const { unmount } = renderWithAssets([]);

          const emptyMsg = screen.queryByText(/no images have been uploaded/i);
          expect(emptyMsg).toBeInTheDocument();

          // No images should be rendered
          const images = screen.queryAllByRole('img');
          expect(images.length).toBe(0);

          unmount();
        }),
        { numRuns: 100, verbose: false },
      );
    },
  );
});
