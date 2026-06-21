import { useState, useEffect, useCallback, useRef } from "react";
import {
  entryRelationshipsApi,
  type EntryRelationship,
} from "@/lib/api/entry-relationships";

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseRelationshipsResult {
  relationships: EntryRelationship[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
  /** Call after a successful create or delete to trigger a refetch. */
  notifyMutated: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Manages fetching and refreshing the relationships list for a given entry.
 *
 * State machine:
 * - `isFetching` (ref): true while a GET is in-flight
 * - `pendingRefetch` (ref): set to true when notifyMutated() is called during
 *   an active fetch. On fetch completion, if the flag is set the hook clears
 *   it and issues exactly one more fetch — satisfying Requirement 7.5.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 */
export function useRelationships(
  entryId: string | undefined
): UseRelationshipsResult {
  const [relationships, setRelationships] = useState<EntryRelationship[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // Use refs for the state-machine flags to avoid stale closures in callbacks.
  const isFetchingRef = useRef(false);
  const pendingRefetchRef = useRef(false);

  const fetchRelationships = useCallback(async () => {
    // Requirement 7.2: do not fetch when entryId is absent
    if (!entryId) return;

    isFetchingRef.current = true;
    setIsLoading(true);
    setIsError(false);

    try {
      const data = await entryRelationshipsApi.listRelationships(entryId);
      setRelationships(data);
    } catch {
      setIsError(true);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);

      // Requirement 7.5: if a mutation arrived while this fetch was in-flight,
      // issue exactly one follow-up fetch now that we are clear.
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        // Schedule as a microtask so React's state updates from the try/catch
        // above flush before the next fetch begins.
        void Promise.resolve().then(() => fetchRelationships());
      }
    }
  // fetchRelationships is stable because entryId is captured from closure and
  // the refs never trigger re-creation. eslint-disable-next-line is intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  // Requirement 7.1: fetch when entryId becomes available or changes.
  useEffect(() => {
    if (entryId) {
      void fetchRelationships();
    } else {
      // Requirement 7.2: clear data when entryId becomes undefined
      setRelationships([]);
      setIsLoading(false);
      setIsError(false);
    }
  }, [entryId, fetchRelationships]);

  /**
   * Requirement 7.4 / 7.5 / 7.6:
   * - If no fetch is in progress: immediately re-fetch.
   * - If a fetch is in progress: queue exactly one pending refetch.
   */
  const notifyMutated = useCallback(() => {
    if (!isFetchingRef.current) {
      void fetchRelationships();
    } else {
      pendingRefetchRef.current = true;
    }
  }, [fetchRelationships]);

  /**
   * Requirement 7.7: re-issue the fetch for the current entryId.
   */
  const retry = useCallback(() => {
    void fetchRelationships();
  }, [fetchRelationships]);

  return { relationships, isLoading, isError, retry, notifyMutated };
}
