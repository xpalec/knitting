/**
 * KnittingStore — Zustand store shape for the public encyclopedia app.
 *
 * This is a TypeScript interface only — the actual Zustand store is created
 * in apps/knitting. Defining the shape here keeps it in sync with @knitting/types
 * and avoids importing Zustand into this package.
 *
 * Rules:
 * - Locale lives in the URL, never in the store.
 * - Only client-side ephemeral state belongs here (progress, UI state).
 * - Server data is managed by TanStack Query, not Zustand.
 */

// ---------------------------------------------------------------------------
// Learn path progress
// ---------------------------------------------------------------------------

/**
 * Tracks which entries the user has marked as learned within a learning path.
 * Keyed by path slug; value is a Set of entry IDs.
 *
 * Persisted to localStorage in the [SOON] phase.
 * At launch: in-memory only (resets on page reload).
 */
export interface LearnProgress {
  /** entry IDs the user has marked as learned, keyed by path slug. */
  completedEntries: Record<string, Set<string>>;
  markLearned: (pathSlug: string, entryId: string) => void;
  unmarkLearned: (pathSlug: string, entryId: string) => void;
  isLearned: (pathSlug: string, entryId: string) => boolean;
  getProgress: (pathSlug: string, totalEntries: number) => number;
}

// ---------------------------------------------------------------------------
// KnittingStore
// ---------------------------------------------------------------------------

/**
 * Full Zustand store shape for apps/knitting.
 *
 * Slices:
 * - learn: learning path progress tracking
 *
 * Future slices (add here when needed):
 * - search: recent searches, typeahead state
 * - ui: mobile nav open/close, active tab
 */
export interface KnittingStore extends LearnProgress {}
