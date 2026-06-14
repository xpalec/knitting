'use client';

/**
 * EditorClient — kept for backward compatibility.
 * Prefer importing <RichTextEditor> from '@/components/ui/rich-text-editor'
 * for controlled usage with value/onChange props.
 */

import dynamic from 'next/dynamic';
import type { EditorProps } from '@/components/Editor/Editor';

const Editor = dynamic(() => import('@/components/Editor/Editor'), {
  ssr: false,
  loading: () => (
    <div className="min-h-[140px] rounded-[0.5rem] border border-border bg-background animate-pulse" />
  ),
});

export default function EditorClient(props: EditorProps) {
  return <Editor {...props} />;
}
