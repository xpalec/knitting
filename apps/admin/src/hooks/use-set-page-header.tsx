'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePageHeader } from '@/providers/page-header-provider';

interface UseSetPageHeaderOptions {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Call this at the top of any page component to push its title, description,
 * and action buttons up into the shared topbar.
 *
 * The `actions` argument should be stable (defined inline is fine — the ref
 * approach below captures the latest value on every render without causing
 * infinite loops).
 */
export function useSetPageHeader({ title, description, actions }: UseSetPageHeaderOptions) {
  const { setHeader } = usePageHeader();
  // Keep a ref to the latest actions so the effect always sends current value
  const actionsRef = useRef<ReactNode>(actions);
  actionsRef.current = actions;

  useEffect(() => {
    setHeader({ title, description, actions: actionsRef.current });
  // Re-run when text changes; actions update via ref without re-triggering
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);
}
