'use client';

import { useCallback, useEffect } from 'react';

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

const buildExtensions = (placeholder: string) => [
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
  Image.configure({
    HTMLAttributes: { class: 'content-image' },
    upload: (file: File) =>
      new Promise((resolve) => {
        setTimeout(() => resolve(URL.createObjectURL(file)), 300);
      }),
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
// Main component
// ---------------------------------------------------------------------------

export default function Editor({
  value,
  onChange,
  placeholder = "Press '/' for commands",
  disabled = false,
}: EditorProps) {
  const onValueChange = useCallback(
    debounce((json: unknown) => {
      onChange?.(json);
    }, 300),
    [onChange],
  );

  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: (value as object) ?? null,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate({ editor: e }) {
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

  // Sync value when it changes externally (e.g. locale tab switch)
  useEffect(() => {
    if (!editor) return;
    const incoming = (value as object | null) ?? null;
    const current = editor.getJSON();
    if (JSON.stringify(incoming) !== JSON.stringify(current)) {
      // Pass empty string to clear, or the JSON object to set
      editor.commands.setContent(incoming as Parameters<typeof editor.commands.setContent>[0]);
    }
  }, [value]); // intentionally omit editor — only run on value change

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-[0.5rem] bg-background !border !border-border">
      <RichTextProvider editor={editor}>
        <div className="flex max-h-full w-full flex-col">
          <RichTextToolbar />

          <EditorContent editor={editor} />

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
