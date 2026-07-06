'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Link2, ImageOff } from 'lucide-react';

import { apiUpload } from '@/lib/api/client';
import { mediaApi } from '@/lib/api/media';

import { RichTextProvider } from 'reactjs-tiptap-editor';

// Base Kit
import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { ListItem } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import {
  Dropcursor,
  Gapcursor,
  Placeholder,
  TrailingNode,
} from '@tiptap/extensions';

// Extensions
import { Attachment, RichTextAttachment } from 'reactjs-tiptap-editor/attachment';
import { Blockquote, RichTextBlockquote } from 'reactjs-tiptap-editor/blockquote';
import { Bold, RichTextBold } from 'reactjs-tiptap-editor/bold';
import { BulletList, RichTextBulletList } from 'reactjs-tiptap-editor/bulletlist';
import { Callout, RichTextCallout } from 'reactjs-tiptap-editor/callout';
import { Clear, RichTextClear } from 'reactjs-tiptap-editor/clear';
import { Color, RichTextColor } from 'reactjs-tiptap-editor/color';
import { Column, ColumnNode, MultipleColumnNode, RichTextColumn } from 'reactjs-tiptap-editor/column';
import { RichTextEmoji } from 'reactjs-tiptap-editor/emoji';
import { ExportPdf, RichTextExportPdf } from 'reactjs-tiptap-editor/exportpdf';
import { ExportWord, RichTextExportWord } from 'reactjs-tiptap-editor/exportword';
import { FontSize, RichTextFontSize } from 'reactjs-tiptap-editor/fontsize';
import { Heading, RichTextHeading } from 'reactjs-tiptap-editor/heading';
import { Highlight, RichTextHighlight } from 'reactjs-tiptap-editor/highlight';
import { History, RichTextRedo, RichTextUndo } from 'reactjs-tiptap-editor/history';
import { HorizontalRule, RichTextHorizontalRule } from 'reactjs-tiptap-editor/horizontalrule';
import { Iframe, RichTextIframe } from 'reactjs-tiptap-editor/iframe';
import { Image, RichTextImage } from 'reactjs-tiptap-editor/image';
import { ImportWord, RichTextImportWord } from 'reactjs-tiptap-editor/importword';
import { Indent, RichTextIndent } from 'reactjs-tiptap-editor/indent';
import { Italic, RichTextItalic } from 'reactjs-tiptap-editor/italic';
import { LineHeight, RichTextLineHeight } from 'reactjs-tiptap-editor/lineheight';
import { Link, RichTextLink } from 'reactjs-tiptap-editor/link';
import { Mention } from 'reactjs-tiptap-editor/mention';
import { MoreMark, RichTextMoreMark } from 'reactjs-tiptap-editor/moremark';
import { OrderedList, RichTextOrderedList } from 'reactjs-tiptap-editor/orderedlist';
import { RichTextSearchAndReplace, SearchAndReplace } from 'reactjs-tiptap-editor/searchandreplace';
import { RichTextStrike, Strike } from 'reactjs-tiptap-editor/strike';
import { RichTextTable, Table } from 'reactjs-tiptap-editor/table';
import { RichTextTaskList, TaskList } from 'reactjs-tiptap-editor/tasklist';
import { RichTextAlign, TextAlign } from 'reactjs-tiptap-editor/textalign';
import { RichTextTextDirection } from 'reactjs-tiptap-editor/textdirection';
import { RichTextUnderline, TextUnderline } from 'reactjs-tiptap-editor/textunderline';
import { RichTextVideo, Video } from 'reactjs-tiptap-editor/video';
import { SlashCommand, SlashCommandList } from 'reactjs-tiptap-editor/slashcommand';
import {
  RichTextBubbleCallout,
  RichTextBubbleColumns,
  RichTextBubbleDrawer,
  RichTextBubbleExcalidraw,
  RichTextBubbleIframe,
  RichTextBubbleImage,
  RichTextBubbleLink,
  RichTextBubbleMenuDragHandle,
  RichTextBubbleTable,
  RichTextBubbleText,
  RichTextBubbleVideo,
} from 'reactjs-tiptap-editor/bubble';
import 'reactjs-tiptap-editor/style.css';

import { EditorContent, useEditor } from '@tiptap/react';
import './editor.css';
import './extensions/smart-image/smart-image.css'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorProps {
  /** TipTap JSON document object. Pass null/undefined for an empty editor. */
  value?: unknown;
  /** Called with the TipTap JSON doc whenever content changes, or null when empty. */
  onChange?: (json: unknown | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When provided, image uploads are stored as MediaAsset records for this entity */
  sourceType?: 'entry' | 'article';
  /** UUID of the entry or article — required alongside sourceType for entity uploads */
  sourceId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertBase64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';
  const bstr = atob(parts[1] ?? '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function debounce<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return function (this: unknown, ...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  } as T;
}

// ---------------------------------------------------------------------------
// Document extension supporting columns
// ---------------------------------------------------------------------------

const DocumentColumn = Document.extend({
  content: '(block|columns)+',
});

// ---------------------------------------------------------------------------
// Image upload
// ---------------------------------------------------------------------------

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Fallback: upload to the editor-image endpoint (no entity association). */
async function uploadEditorImage(file: File): Promise<string> {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    toast.error('Unsupported image type. Please use JPEG, PNG, GIF, or WebP.');
    throw new Error('Unsupported file type');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error('Image is too large. Maximum size is 10 MB.');
    throw new Error('File too large');
  }
  const form = new FormData();
  form.append('file', file);
  try {
    const result = await apiUpload<{ url: string }>('/api/v1/admin/media/image-upload', form);
    return result.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image upload failed.';
    toast.error(message);
    throw err;
  }
}

/**
 * Entity-aware upload — creates a MediaAsset record, returns the medium-size URL
 * for inline display and the original URL for lightbox use.
 */
async function uploadForEntity(
  file: File,
  sourceType: 'entry' | 'article',
  sourceId: string,
  onUploaded: (originalUrl: string) => void,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const asset =
    sourceType === 'entry'
      ? await mediaApi.uploadForEntry(sourceId, form)
      : await mediaApi.uploadForArticle(sourceId, form);
  onUploaded(asset.url_original);
  // Return the medium variant as the in-editor display src (falls back to original)
  return asset.url_medium ?? asset.url_original;
}

// ---------------------------------------------------------------------------
// LightboxImage — extends the Image node with a data-lightbox attribute
// ---------------------------------------------------------------------------

const LightboxImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-lightbox': {
        default: null,
        parseHTML: (el: Element) => el.getAttribute('data-lightbox'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs['data-lightbox'] ? { 'data-lightbox': attrs['data-lightbox'] } : {},
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

const BaseKit = [
  DocumentColumn,
  Text,
  Dropcursor.configure({
    class: 'reactjs-tiptap-editor-theme',
    color: 'hsl(var(--primary))',
    width: 2,
  }),
  Gapcursor,
  HardBreak,
  Paragraph,
  TrailingNode,
  ListItem,
  TextStyle,
];

const buildExtensions = (placeholder: string, upload: (file: File) => Promise<string>) => [
  ...BaseKit,
  Placeholder.configure({ placeholder }),
  History,
  SearchAndReplace,
  Clear,
  Heading,
  FontSize,
  Bold,
  Italic,
  TextUnderline,
  Strike,
  MoreMark,
  Color,
  Highlight,
  BulletList,
  OrderedList,
  TextAlign,
  Indent,
  LineHeight,
  TaskList,
  Link,
  LightboxImage.configure({
    HTMLAttributes: { class: 'content-image' },
    upload,
  }),
  Video.configure({
    upload: (file: File) =>
      new Promise((resolve) => {
        setTimeout(() => resolve(URL.createObjectURL(file)), 300);
      }),
  }),
  Blockquote,
  HorizontalRule,
  Column,
  ColumnNode,
  MultipleColumnNode,
  Table,
  Iframe,
  ExportPdf,
  ImportWord,
  ExportWord,
  Attachment.configure({
    upload: (file: File) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      return new Promise((resolve) => {
        reader.onload = () => {
          const blob = convertBase64ToBlob(reader.result as string);
          resolve(URL.createObjectURL(blob));
        };
      });
    },
  }),
  Mention.configure({
    suggestions: [
      {
        char: '@',
        items: async ({ query }: { query: string }) =>
          ['Alice', 'Bob', 'Carol'].filter((n) =>
            n.toLowerCase().startsWith(query.toLowerCase()),
          ),
      },
    ],
  }),
  SlashCommand,
  Callout,
];

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function RichTextToolbar() {
  return (
    <div className="flex items-center !p-1 gap-2 flex-wrap !border-b !border-solid !border-border">
      <RichTextUndo />
      <RichTextRedo />
      <RichTextSearchAndReplace />
      <RichTextClear />
      <RichTextHeading />
      <RichTextFontSize />
      <RichTextBold />
      <RichTextItalic />
      <RichTextUnderline />
      <RichTextStrike />
      <RichTextMoreMark />
      <RichTextEmoji />
      <RichTextColor />
      <RichTextHighlight />
      <RichTextBulletList />
      <RichTextOrderedList />
      <RichTextAlign />
      <RichTextIndent />
      <RichTextLineHeight />
      <RichTextTaskList />
      <RichTextLink />
      <RichTextImage />
      <RichTextVideo />
      <RichTextBlockquote />
      <RichTextHorizontalRule />
      <RichTextColumn />
      <RichTextTable />
      <RichTextIframe />
      <RichTextExportPdf />
      <RichTextImportWord />
      <RichTextExportWord />
      <RichTextTextDirection />
      <RichTextAttachment />
      <RichTextCallout />
    </div>
  );
}

// ---------------------------------------------------------------------------
// LightboxBar — floats below a selected image to set/clear the lightbox URL.
// We track selection manually (no BubbleMenu component needed).
// ---------------------------------------------------------------------------

interface LightboxBarProps {
  editor: ReturnType<typeof useEditor>;
  /** Whether an imageUpload node is currently selected */
  imageSelected: boolean;
}

function LightboxBar({ editor, imageSelected }: LightboxBarProps) {
  if (!editor || !imageSelected) return null;

  const attrs = editor.getAttributes('imageUpload');
  const currentLightbox: string = attrs['data-lightbox'] ?? '';

  function handleSet() {
    const url = window.prompt(
      'Lightbox URL — the full-size original shown in the lightbox:',
      currentLightbox,
    );
    if (url === null) return; // cancelled
    editor
      .chain()
      .focus()
      .updateAttributes('imageUpload', { 'data-lightbox': url || null })
      .run();
  }

  function handleClear() {
    editor
      .chain()
      .focus()
      .updateAttributes('imageUpload', { 'data-lightbox': null })
      .run();
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-t border-slate-100 bg-slate-50">
      <span className="text-xs text-slate-500 mr-1">Lightbox:</span>
      <button
        type="button"
        onClick={handleSet}
        title={currentLightbox ? 'Change lightbox URL' : 'Set original-size URL for lightbox'}
        className={[
          'flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors',
          currentLightbox
            ? 'bg-violet-100 text-violet-700 hover:bg-violet-200'
            : 'text-slate-600 border border-slate-200 hover:bg-white',
        ].join(' ')}
      >
        <Link2 size={12} aria-hidden="true" />
        {currentLightbox ? 'Edit URL ✓' : 'Set URL'}
      </button>
      {currentLightbox && (
        <button
          type="button"
          onClick={handleClear}
          title="Remove lightbox URL"
          className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-500 border border-slate-200 hover:bg-white transition-colors"
        >
          <ImageOff size={12} aria-hidden="true" />
          Clear
        </button>
      )}
      {currentLightbox && (
        <span
          className="ml-1 text-xs text-slate-400 truncate max-w-[200px]"
          title={currentLightbox}
        >
          {currentLightbox}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function Editor({
  value,
  onChange,
  placeholder = "Press '/' for commands",
  disabled = false,
  sourceType,
  sourceId,
}: EditorProps) {
  const queryClient = useQueryClient();

  // Use refs so the upload callback doesn't cause extension re-init on re-render
  const sourceTypeRef = useRef(sourceType);
  const sourceIdRef = useRef(sourceId);
  useEffect(() => { sourceTypeRef.current = sourceType; }, [sourceType]);
  useEffect(() => { sourceIdRef.current = sourceId; }, [sourceId]);

  // Track pending lightbox URL from entity upload (set during upload, applied after insert)
  const pendingLightboxRef = useRef<string | null>(null);

  // imageSelected — updated via editor event subscription (avoids shouldRerenderOnTransaction loop)
  const [imageSelected, setImageSelected] = useState(false);

  const uploadFn = useCallback(async (file: File): Promise<string> => {
    const sType = sourceTypeRef.current;
    const sId = sourceIdRef.current;

    if (sType && sId) {
      try {
        return await uploadForEntity(file, sType, sId, (originalUrl) => {
          // Store original URL so we can patch data-lightbox after the node is inserted
          pendingLightboxRef.current = originalUrl;
          // Invalidate the Images tab query so it refreshes
          queryClient.invalidateQueries({ queryKey: ['media-assets', sType, sId] });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        toast.error(msg);
        throw err;
      }
    }
    return uploadEditorImage(file);
  }, [queryClient]);

  const onValueChange = useCallback(
    debounce((json: unknown) => {
      onChange?.(json);
    }, 300),
    [onChange],
  );

  const editor = useEditor({
    extensions: buildExtensions(placeholder, uploadFn),
    content: (value as object) ?? null,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate({ editor: e }) {
      // After an entity upload inserts the node, patch it with the lightbox URL
      if (pendingLightboxRef.current) {
        const lightboxUrl = pendingLightboxRef.current;
        pendingLightboxRef.current = null;
        // Find the most-recently inserted imageUpload node without a lightbox set
        let patched = false;
        e.state.doc.descendants((node, pos) => {
          if (patched) return false;
          if (node.type.name === 'imageUpload' && !node.attrs['data-lightbox']) {
            e.chain()
              .setNodeSelection(pos)
              .updateAttributes('imageUpload', { 'data-lightbox': lightboxUrl })
              .run();
            patched = true;
            return false;
          }
        });
      }

      if (!onChange) return;
      const json = e.getJSON();
      const first = json.content?.[0];
      const isEmpty =
        json.content?.length === 1 &&
        first?.type === 'paragraph' &&
        (!first.content || first.content.length === 0);
      onValueChange(isEmpty ? null : json);
    },
  });
  // Sync editable state when disabled prop changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Subscribe to selection/transaction events to update imageSelected
  useEffect(() => {
    if (!editor) return;
    const update = () => setImageSelected(editor.isActive('imageUpload'));
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  // Sync value when it changes externally (e.g. locale tab switch)
  useEffect(() => {
    if (!editor) return;
    const incoming = (value as object | null) ?? null;
    const current = editor.getJSON();
    if (JSON.stringify(incoming) !== JSON.stringify(current)) {
      editor.commands.setContent(incoming as Parameters<typeof editor.commands.setContent>[0]);
    }
  }, [value]); // intentionally omit editor — only run on value change

  if (!editor) return null;

  return (
    <div className="rte-wrapper overflow-hidden rounded-[0.5rem] bg-background !border !border-border">
      <RichTextProvider editor={editor}>
        <div className="flex max-h-full w-full flex-col">
          <RichTextToolbar />

          <EditorContent editor={editor} />

          {/* Lightbox URL bar — appears below editor when an image is selected */}
          <LightboxBar editor={editor} imageSelected={imageSelected} />

          {/* Bubble menus */}
          <RichTextBubbleColumns />
          <RichTextBubbleDrawer />
          <RichTextBubbleExcalidraw />
          <RichTextBubbleIframe />
          <RichTextBubbleLink />
          <RichTextBubbleImage />
          <RichTextBubbleVideo />
          <RichTextBubbleTable />
          <RichTextBubbleText />
          <RichTextBubbleCallout />

          {/* Slash command list */}
          <SlashCommandList />
          <RichTextBubbleMenuDragHandle />
        </div>
      </RichTextProvider>
    </div>
  );
}
