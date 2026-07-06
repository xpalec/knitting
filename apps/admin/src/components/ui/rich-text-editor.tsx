'use client';

/**
 * RichTextEditor — thin wrapper around the full-featured Editor component.
 *
 * All existing call sites keep the same `value / onChange / placeholder /
 * disabled / className / showCharacterCount / maxCharacters` props.
 * The Editor is loaded lazily (no SSR) so there are no hydration issues.
 */

import dynamic from 'next/dynamic';
import type { EditorProps } from '@/components/Editor/Editor';

// ---------------------------------------------------------------------------
// Public props — superset of EditorProps so call sites need no changes
// ---------------------------------------------------------------------------

export interface RichTextEditorProps extends EditorProps {
  /** Kept for backward compatibility — ignored (Editor manages its own count) */
  showCharacterCount?: boolean;
  /** Kept for backward compatibility — ignored */
  maxCharacters?: number;
  /** When provided, editor image uploads are linked to this entity (Option B) */
  sourceType?: 'entry' | 'article';
  /** When provided together with sourceType, uploads are stored as MediaAsset records */
  sourceId?: string;
}

// ---------------------------------------------------------------------------
// Lazy-loaded editor (SSR disabled — TipTap requires the DOM)
// ---------------------------------------------------------------------------

const EditorComponent = dynamic(
  () => import('@/components/Editor/Editor'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[140px] rounded-[0.5rem] border border-border bg-background animate-pulse" />
    ),
  },
);

// ---------------------------------------------------------------------------
// Re-export
// ---------------------------------------------------------------------------

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  sourceType,
  sourceId,
  // backward-compat props — intentionally unused
  showCharacterCount: _showCharacterCount,
  maxCharacters: _maxCharacters,
}: RichTextEditorProps) {
  return (
    <EditorComponent
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      sourceType={sourceType}
      sourceId={sourceId}
    />
  );
}
