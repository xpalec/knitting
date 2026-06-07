'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import TextAlign from '@tiptap/extension-text-align';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import CharacterCount from '@tiptap/extension-character-count';
import Image from '@tiptap/extension-image';
import Typography from '@tiptap/extension-typography';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Unlink,
  Image as ImageIcon,
  Pilcrow,
  Code2,
  Undo,
  Redo,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  value?: unknown;
  onChange?: (json: unknown | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showCharacterCount?: boolean;
  maxCharacters?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Sep() {
  return <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden="true" />;
}

function ToolbarBtn({
  onClick,
  active,
  disabled,
  title,
  children,
  size = 'md',
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'flex items-center justify-center rounded text-slate-600 transition-colors shrink-0',
        'hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed',
        active && 'bg-violet-100 text-violet-700',
        size === 'sm' ? 'h-6 w-6' : 'h-7 w-7',
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Link popover
// ---------------------------------------------------------------------------

function LinkPopover({
  editor,
  onClose,
}: {
  editor: ReturnType<typeof useEditor>;
  onClose: () => void;
}) {
  const [href, setHref] = useState(editor?.getAttributes('link').href ?? '');

  function apply() {
    if (!editor) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: href.trim(), target: '_blank' }).run();
    }
    onClose();
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
      <LinkIcon size={13} className="shrink-0 text-slate-400" />
      <input
        autoFocus
        type="url"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); apply(); }
          if (e.key === 'Escape') onClose();
        }}
        placeholder="https://..."
        className="w-52 text-xs outline-none text-slate-700 placeholder:text-slate-400"
      />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); apply(); }}
        className="text-xs font-medium text-violet-600 hover:text-violet-700 px-1">
        Apply
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image popover
// ---------------------------------------------------------------------------

function ImagePopover({
  editor,
  onClose,
}: {
  editor: ReturnType<typeof useEditor>;
  onClose: () => void;
}) {
  const [src, setSrc] = useState('');

  function apply() {
    if (!editor || !src.trim()) return;
    editor.chain().focus().setImage({ src: src.trim() }).run();
    onClose();
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
      <ImageIcon size={13} className="shrink-0 text-slate-400" />
      <input
        autoFocus
        type="url"
        value={src}
        onChange={(e) => setSrc(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); apply(); }
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Image URL…"
        className="w-52 text-xs outline-none text-slate-700 placeholder:text-slate-400"
      />
      <button type="button" onMouseDown={(e) => { e.preventDefault(); apply(); }}
        className="text-xs font-medium text-violet-600 hover:text-violet-700 px-1">
        Insert
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Floating bubble menu (shown on text selection)
// ---------------------------------------------------------------------------

function BubbleToolbar({
  editor,
  onOpenLink,
}: {
  editor: ReturnType<typeof useEditor>;
  onOpenLink: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const update = () => {
      const { selection } = editor.state;
      const { from, to } = selection;
      if (from === to) { setPos(null); return; } // no selection

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) { setPos(null); return; }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const editorEl = editor.view.dom.closest('[data-rte-wrapper]') as HTMLElement | null;
      if (!editorEl) { setPos(null); return; }

      const wrapRect = editorEl.getBoundingClientRect();
      const bubbleWidth = ref.current?.offsetWidth ?? 280;

      let left = rect.left - wrapRect.left + rect.width / 2 - bubbleWidth / 2;
      left = Math.max(4, Math.min(left, wrapRect.width - bubbleWidth - 4));

      setPos({
        top: rect.top - wrapRect.top - (ref.current?.offsetHeight ?? 36) - 6,
        left,
      });
    };

    editor.on('selectionUpdate', update);
    editor.on('blur', () => setPos(null));
    return () => {
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  if (!pos || !editor) return null;

  const sz = 12;

  return (
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left }}
      className="absolute z-50 flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-1 shadow-lg pointer-events-auto"
    >
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold" size="sm">
        <Bold size={sz} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic" size="sm">
        <Italic size={sz} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline" size="sm">
        <UnderlineIcon size={sz} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike" size="sm">
        <Strikethrough size={sz} />
      </ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code" size="sm">
        <CodeIcon size={sz} />
      </ToolbarBtn>
      <Sep />
      <ToolbarBtn
        onClick={() => {
          if (editor.isActive('link')) {
            editor.chain().focus().unsetLink().run();
          } else {
            onOpenLink();
          }
        }}
        active={editor.isActive('link')}
        title={editor.isActive('link') ? 'Remove link' : 'Add link'}
        size="sm"
      >
        {editor.isActive('link') ? <Unlink size={sz} /> : <LinkIcon size={sz} />}
      </ToolbarBtn>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write something…',
  disabled = false,
  className,
  showCharacterCount = false,
  maxCharacters,
}: RichTextEditorProps) {
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [showImagePopover, setShowImagePopover] = useState(false);

  const handleLinkToggle = useCallback(() => {
    setShowImagePopover(false);
    setShowLinkPopover((v) => !v);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        strike: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
      }),
      Heading.configure({ levels: [2, 3] }),
      Underline,
      Strike,
      Code,
      CodeBlock,
      Blockquote,
      BulletList,
      OrderedList,
      ListItem,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      HorizontalRule,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Typography,
      CharacterCount.configure({ limit: maxCharacters }),
      Placeholder.configure({ placeholder }),
    ],
    content: (value as object) ?? null,
    editable: !disabled,
    immediatelyRender: true,
    onUpdate({ editor }) {
      if (onChange) {
        const json = editor.getJSON();
        const firstNode = json.content?.[0];
        const isEmpty =
          json.content?.length === 1 &&
          firstNode?.type === 'paragraph' &&
          (!firstNode?.content || firstNode.content.length === 0);
        onChange(isEmpty ? null : json);
      }
    },
  });

  if (!editor) return null;

  const sz = 13 as const;

  return (
    <div
      data-rte-wrapper
      className={cn(
        'relative rounded-md border border-slate-200 bg-white text-slate-800',
        disabled && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {/* ── Bubble toolbar ─────────────────────────────────────────────── */}
      <BubbleToolbar editor={editor} onOpenLink={handleLinkToggle} />

      {/* ── Fixed toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1.5">

        {/* History */}
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || disabled} title="Undo">
          <Undo size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || disabled} title="Redo">
          <Redo size={sz} />
        </ToolbarBtn>
        <Sep />

        {/* Block type */}
        <ToolbarBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} disabled={disabled} title="Paragraph">
          <Pilcrow size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} disabled={disabled} title="Heading 2">
          <Heading2 size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} disabled={disabled} title="Heading 3">
          <Heading3 size={sz} />
        </ToolbarBtn>
        <Sep />

        {/* Inline marks */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} disabled={disabled} title="Bold (Ctrl+B)">
          <Bold size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} disabled={disabled} title="Italic (Ctrl+I)">
          <Italic size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} disabled={disabled} title="Underline (Ctrl+U)">
          <UnderlineIcon size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} disabled={disabled} title="Strikethrough">
          <Strikethrough size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} disabled={disabled} title="Inline code">
          <CodeIcon size={sz} />
        </ToolbarBtn>
        <Sep />

        {/* Lists */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} disabled={disabled} title="Bullet list">
          <List size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} disabled={disabled} title="Ordered list">
          <ListOrdered size={sz} />
        </ToolbarBtn>
        <Sep />

        {/* Blocks */}
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} disabled={disabled} title="Blockquote">
          <Quote size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} disabled={disabled} title="Code block">
          <Code2 size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={disabled} title="Horizontal rule">
          <Minus size={sz} />
        </ToolbarBtn>
        <Sep />

        {/* Alignment */}
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} disabled={disabled} title="Align left">
          <AlignLeft size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} disabled={disabled} title="Align center">
          <AlignCenter size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} disabled={disabled} title="Align right">
          <AlignRight size={sz} />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} disabled={disabled} title="Justify">
          <AlignJustify size={sz} />
        </ToolbarBtn>
        <Sep />

        {/* Link */}
        <div className="relative">
          <ToolbarBtn
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowImagePopover(false);
                setShowLinkPopover((v) => !v);
              }
            }}
            active={editor.isActive('link') || showLinkPopover}
            disabled={disabled}
            title={editor.isActive('link') ? 'Remove link' : 'Add link'}
          >
            {editor.isActive('link') ? <Unlink size={sz} /> : <LinkIcon size={sz} />}
          </ToolbarBtn>
          {showLinkPopover && (
            <div className="absolute top-full left-0 mt-1 z-50">
              <LinkPopover editor={editor} onClose={() => setShowLinkPopover(false)} />
            </div>
          )}
        </div>

        {/* Image */}
        <div className="relative">
          <ToolbarBtn
            onClick={() => {
              setShowLinkPopover(false);
              setShowImagePopover((v) => !v);
            }}
            active={showImagePopover}
            disabled={disabled}
            title="Insert image"
          >
            <ImageIcon size={sz} />
          </ToolbarBtn>
          {showImagePopover && (
            <div className="absolute top-full left-0 mt-1 z-50">
              <ImagePopover editor={editor} onClose={() => setShowImagePopover(false)} />
            </div>
          )}
        </div>
      </div>

      {/* ── Editor content ──────────────────────────────────────────────── */}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none px-4 py-3 text-slate-800',
          'focus-within:outline-none',
          '[&_.tiptap]:min-h-[140px] [&_.tiptap]:outline-none',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:text-slate-400',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
          '[&_.tiptap_h2]:text-lg [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:mt-4 [&_.tiptap_h2]:mb-2',
          '[&_.tiptap_h3]:text-base [&_.tiptap_h3]:font-semibold [&_.tiptap_h3]:mt-3 [&_.tiptap_h3]:mb-1',
          '[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5',
          '[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5',
          '[&_.tiptap_blockquote]:border-l-4 [&_.tiptap_blockquote]:border-violet-300 [&_.tiptap_blockquote]:pl-4 [&_.tiptap_blockquote]:italic [&_.tiptap_blockquote]:text-slate-500',
          '[&_.tiptap_hr]:my-4 [&_.tiptap_hr]:border-slate-200',
          '[&_.tiptap_img]:rounded-md [&_.tiptap_img]:max-w-full',
          '[&_.tiptap_a]:text-violet-600 [&_.tiptap_a]:underline',
          '[&_.tiptap_code]:rounded [&_.tiptap_code]:bg-slate-100 [&_.tiptap_code]:px-1 [&_.tiptap_code]:py-0.5 [&_.tiptap_code]:font-mono [&_.tiptap_code]:text-sm',
          '[&_.tiptap_pre]:rounded-md [&_.tiptap_pre]:bg-slate-900 [&_.tiptap_pre]:p-4 [&_.tiptap_pre]:text-slate-100 [&_.tiptap_pre]:overflow-x-auto',
        )}
      />

      {/* ── Character count ──────────────────────────────────────────────── */}
      {showCharacterCount && (
        <div className={cn(
          'flex justify-end border-t border-slate-100 px-3 py-1.5 text-xs text-slate-400',
          maxCharacters && editor.storage.characterCount.characters() > maxCharacters && 'text-red-500',
        )}>
          {editor.storage.characterCount.words()} words
          {maxCharacters != null && (
            <span className="ml-2">
              · {editor.storage.characterCount.characters()}/{maxCharacters} chars
            </span>
          )}
        </div>
      )}
    </div>
  );
}
