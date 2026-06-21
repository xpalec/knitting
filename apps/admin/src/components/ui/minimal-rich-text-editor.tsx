'use client';

/**
 * MinimalRichTextEditor — lightweight TipTap editor.
 *
 * Toolbar: undo/redo · block type · bold · italic · underline · strike
 *          · bullet list · ordered list · align · link · clear formatting
 *
 * Same value/onChange API as RichTextEditor (TipTap JSON).
 */

import dynamic from 'next/dynamic';
import type { MinimalEditorProps } from '@/components/Editor/MinimalEditor';

export type { MinimalEditorProps };

const MinimalEditorComponent = dynamic(
  () => import('@/components/Editor/MinimalEditor'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[160px] rounded-md border border-input bg-background animate-pulse" />
    ),
  },
);

export function MinimalRichTextEditor(props: MinimalEditorProps) {
  return <MinimalEditorComponent {...props} />;
}
