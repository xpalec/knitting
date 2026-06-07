'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePageHeader } from '@/providers/page-header-provider';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode; // action buttons — rendered in-page, right-aligned above content
}

/**
 * Sends title + description up to the topbar via context.
 * Renders action buttons (children) inline in the page body, right-aligned.
 *
 * Layout matches the design: topbar shows breadcrumb-style title, while
 * buttons like Import / Filters / Add sit above the tab bar in the content area.
 */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { setHeader } = usePageHeader();
  const titleRef = useRef(title);
  const descRef = useRef(description);
  titleRef.current = title;
  descRef.current = description;

  useEffect(() => {
    setHeader({ title: titleRef.current, description: descRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description]);

  // Render action buttons in the page body if provided
  if (!children) return null;

  return (
    <div className="flex justify-end gap-3 lg:mb-0">
      {children}
    </div>
  );
}
