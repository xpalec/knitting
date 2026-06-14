'use client';

import { useState, useMemo } from 'react';
import {
  Save, Trash2, X, ChevronDown, ChevronUp,
  GripVertical, MoreHorizontal, Plus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CoverImageUpload } from '@/components/articles/cover-image-upload';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import type { ArticleStatus, ArticleLocale } from '@/lib/api/articles';
import { ARTICLE_SUPPORTED_LOCALES, ARTICLE_LOCALE_LABELS } from '@/lib/api/articles';
import { hasAtLeastOneCompleteLocale, type ValidationRule } from '@/lib/validation';
import { useLanguages } from '@/hooks/useLanguages';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;

const BLOCK_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  rich_text: { bg: '#EDE7FF', fg: '#7F6BBF' },
  callout:   { bg: '#FEF3C7', fg: '#B45309' },
  steps:     { bg: '#DCFCE7', fg: '#16A34A' },
  key_facts: { bg: '#E0F2FE', fg: '#0369A1' },
  video:     { bg: '#FFE4E6', fg: '#BE123C' },
  image:     { bg: '#FEF9C3', fg: '#A16207' },
};
const BLOCK_TYPE_FALLBACK = { bg: '#EEEEF2', fg: '#8B8FA8' };

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

let _idSeq = 0;
function nextId() { return `ab-${++_idSeq}`; }

export interface ArticleBlockState {
  _id: string;         // local React key
  blockId: string;     // stable UUID (new blocks get a generated id)
  type: string;
  label: string;
  order: number;
  visible: boolean;
  required: boolean;
  /** Heading + content per locale */
  locales: Partial<Record<ArticleLocale, { heading: string; content: unknown | null }>>;
}

export interface ArticleLocaleTabState {
  title: string;
  slug: string;
  slugManuallyEdited: boolean;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
}

export interface ArticleEditorFormValues {
  status: ArticleStatus;
  tags: string[];
  author: string;
  cover_image_url: string | undefined;
  category_id: string;
  locales: Record<string, ArticleLocaleTabState>;
  blocks: ArticleBlockState[];
}

export interface ArticleEditorFormProps {
  defaultValues?: Partial<ArticleEditorFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: ArticleEditorFormValues) => void | Promise<void>;
  onSaveDraft?: (values: ArticleEditorFormValues) => void | Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
  title?: string;
  validationRules?: ValidationRule<ArticleEditorFormValues>[];
}

// ---------------------------------------------------------------------------
// Default state builders
// ---------------------------------------------------------------------------

function defaultLocaleTab(): ArticleLocaleTabState {
  return {
    title: '',
    slug: '',
    slugManuallyEdited: false,
    shortDescription: '',
    seoTitle: '',
    seoDescription: '',
  };
}

function buildDefaultLocales(
  activeLocales: string[],
  partial?: Partial<ArticleEditorFormValues>,
): Record<string, ArticleLocaleTabState> {
  const result: Record<string, ArticleLocaleTabState> = {};
  for (const locale of activeLocales) {
    result[locale] = { ...defaultLocaleTab(), ...(partial?.locales?.[locale as ArticleLocale] ?? {}) };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Status pill with dropdown
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<ArticleStatus, string> = {
  draft:      'bg-slate-100 text-slate-600 border-slate-200',
  review:     'bg-amber-50 text-amber-700 border-amber-200',
  published:  'bg-green-50 text-green-700 border-green-200',
  deprecated: 'bg-red-50 text-red-600 border-red-200',
};
const STATUS_DOT: Record<ArticleStatus, string> = {
  draft:      'bg-slate-400',
  review:     'bg-amber-500',
  published:  'bg-green-500',
  deprecated: 'bg-red-500',
};
const STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: 'Draft', review: 'In Review', published: 'Published', deprecated: 'Deprecated',
};

interface StatusPillProps {
  status: ArticleStatus;
  onChange: (status: ArticleStatus) => void;
  disabled?: boolean;
}

function StatusPill({ status, onChange, disabled }: StatusPillProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border select-none',
            'hover:opacity-80 transition-opacity',
            STATUS_STYLES[status],
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
          {STATUS_LABELS[status]}
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(STATUS_LABELS) as ArticleStatus[]).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>
            <span className={cn('h-1.5 w-1.5 rounded-full mr-2', STATUS_DOT[s])} />
            {STATUS_LABELS[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Block row
// ---------------------------------------------------------------------------

interface BlockRowProps {
  block: ArticleBlockState;
  activeLocale: ArticleLocale;
  isSubmitting?: boolean;
  onChange: (patch: Partial<ArticleBlockState>) => void;
  onRemove: () => void;
}

function BlockRow({ block, activeLocale, isSubmitting, onChange, onRemove }: BlockRowProps) {
  const [expanded, setExpanded] = useState(true);
  const typeColor = BLOCK_TYPE_COLORS[block.type] ?? BLOCK_TYPE_FALLBACK;
  const localeData = block.locales[activeLocale] ?? { heading: '', content: null };

  function patchLocale(patch: Partial<{ heading: string; content: unknown | null }>) {
    onChange({
      locales: {
        ...block.locales,
        [activeLocale]: { ...localeData, ...patch },
      },
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-white">
        <GripVertical size={15} className="text-slate-300 shrink-0 cursor-grab" aria-hidden="true" />

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="h-5 w-5 rounded shrink-0"
            style={{ backgroundColor: typeColor.bg }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{block.label}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{block.type}</p>
          </div>
        </div>

        {/* Required badge toggle */}
        <button
          type="button"
          onClick={() => onChange({ required: !block.required })}
          disabled={isSubmitting}
          className="shrink-0"
          aria-label={block.required ? 'Mark as optional' : 'Mark as required'}
        >
          {block.required ? (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
              Required
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border border-slate-200 text-slate-400">
              Optional
            </span>
          )}
        </button>

        {/* Visible toggle */}
        <button
          type="button"
          onClick={() => onChange({ visible: !block.visible })}
          disabled={isSubmitting}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
            block.visible ? 'bg-violet-600' : 'bg-slate-200',
          )}
          aria-label={block.visible ? 'Hide block' : 'Show block'}
          role="switch"
          aria-checked={block.visible}
        >
          <span
            className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              block.visible ? 'translate-x-4' : 'translate-x-0.5',
            )}
          />
        </button>

        {/* Expand/collapse */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-400 hover:text-slate-600 shrink-0"
          aria-label={expanded ? 'Collapse block' : 'Expand block'}
        >
          {expanded
            ? <ChevronUp size={15} aria-hidden="true" />
            : <ChevronDown size={15} aria-hidden="true" />}
        </button>

        {/* ⋮ menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" type="button" size="icon" className="h-7 w-7 text-slate-400 shrink-0">
              <MoreHorizontal size={15} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onChange({ visible: !block.visible })}>
              {block.visible ? 'Hide block' : 'Show block'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onChange({ required: !block.required })}>
              Mark as {block.required ? 'optional' : 'required'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onRemove}>
              <X size={13} aria-hidden="true" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Editor body */}
      {expanded && (
        <div className="px-4 pt-3 pb-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Header</label>
            <Input
              value={localeData.heading}
              onChange={(e) => patchLocale({ heading: e.target.value })}
              placeholder="Block heading…"
              disabled={isSubmitting}
              className="h-8 text-sm"
            />
          </div>
          <RichTextEditor
            value={localeData.content}
            onChange={(json) => patchLocale({ content: json })}
            placeholder="Write content…"
            disabled={isSubmitting}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-locale tab content
// ---------------------------------------------------------------------------

interface LocaleTabContentProps {
  locale: ArticleLocale;
  state: ArticleLocaleTabState;
  blocks: ArticleBlockState[];
  isSubmitting: boolean;
  onLocaleChange: (patch: Partial<ArticleLocaleTabState>) => void;
  onBlocksChange: (blocks: ArticleBlockState[]) => void;
}

function LocaleTabContent({
  locale,
  state,
  blocks,
  isSubmitting,
  onLocaleChange,
  onBlocksChange,
}: LocaleTabContentProps) {
  function handleTitleChange(value: string) {
    const patch: Partial<ArticleLocaleTabState> = { title: value };
    if (!state.slugManuallyEdited) patch.slug = toSlug(value);
    onLocaleChange(patch);
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Title + Slug + Short description */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`article-title-${locale}`}>
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`article-title-${locale}`}
              placeholder="Article title"
              value={state.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`article-slug-${locale}`}>
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`article-slug-${locale}`}
              placeholder="article-slug"
              value={state.slug}
              onChange={(e) => onLocaleChange({ slug: e.target.value, slugManuallyEdited: true })}
              disabled={isSubmitting}
              className="font-mono text-sm text-slate-500"
            />
            {state.title.trim() && !state.slug.trim() && (
              <p className="text-xs text-amber-600">
                Add a slug to make this locale complete.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`article-short-desc-${locale}`}>Short description</Label>
          <Textarea
            id={`article-short-desc-${locale}`}
            placeholder="A brief summary of this article…"
            value={state.shortDescription}
            onChange={(e) => onLocaleChange({ shortDescription: e.target.value })}
            disabled={isSubmitting}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      {/* Content blocks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Content blocks</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs border-dashed"
            disabled={isSubmitting}
            onClick={() => {
              const newBlock: ArticleBlockState = {
                _id: nextId(),
                blockId: nextId(),
                type: 'rich_text',
                label: 'Rich Text',
                order: blocks.length + 1,
                visible: true,
                required: false,
                locales: {},
              };
              onBlocksChange([...blocks, newBlock]);
            }}
          >
            <Plus size={13} aria-hidden="true" />
            Add block
          </Button>
        </div>

        {blocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No content blocks yet. Add a block to start editing content.
          </div>
        ) : (
          <div className="space-y-3">
            {blocks.map((block) => (
              <BlockRow
                key={block._id}
                block={block}
                activeLocale={locale}
                isSubmitting={isSubmitting}
                onChange={(patch) =>
                  onBlocksChange(blocks.map((b) => b._id === block._id ? { ...b, ...patch } : b))
                }
                onRemove={() =>
                  onBlocksChange(blocks.filter((b) => b._id !== block._id))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip input (tags)
// ---------------------------------------------------------------------------

interface ChipInputProps {
  label: string;
  chips: string[];
  onChange: (chips: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function ChipInput({ label, chips, onChange, placeholder = 'Add…', disabled }: ChipInputProps) {
  const [input, setInput] = useState('');

  function add() {
    const val = input.trim();
    if (!val || chips.includes(val)) { setInput(''); return; }
    onChange([...chips, val]);
    setInput('');
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">{label}</Label>
      <div className={cn(
        'flex flex-wrap items-center gap-1.5 min-h-[38px] rounded-md border border-slate-200 bg-white px-2 py-1.5',
        'focus-within:ring-1 focus-within:ring-violet-400 focus-within:border-violet-400',
      )}>
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
          >
            {chip}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(chips.filter((c) => c !== chip))}
                className="text-slate-400 hover:text-slate-600"
                aria-label={`Remove ${chip}`}
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(); }
            if (e.key === 'Backspace' && !input && chips.length) onChange(chips.slice(0, -1));
          }}
          placeholder={chips.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] text-xs outline-none bg-transparent text-slate-700 placeholder:text-slate-400"
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || !input.trim()}
          className="ml-auto rounded p-0.5 text-slate-400 hover:text-violet-600 disabled:opacity-30"
          aria-label="Add"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ArticleEditorForm
// ---------------------------------------------------------------------------

export function ArticleEditorForm({
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onSaveDraft,
  onCancel,
  onDelete,
  title,
  validationRules,
}: ArticleEditorFormProps) {
  const { allLocales, localeLabels, defaultLanguage } = useLanguages();
  const activeLocales = allLocales.length > 0 ? allLocales : ['en'];
  const defaultLocale = defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  const [status, setStatus] = useState<ArticleStatus>(defaultValues?.status ?? 'draft');
  const [tags, setTags] = useState<string[]>(defaultValues?.tags ?? []);
  const [author, setAuthor] = useState(defaultValues?.author ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>(defaultValues?.cover_image_url);
  const [categoryId, setCategoryId] = useState(defaultValues?.category_id ?? '');
  const [locales, setLocales] = useState<Record<string, ArticleLocaleTabState>>(
    () => buildDefaultLocales(activeLocales, defaultValues),
  );
  const [blocks, setBlocks] = useState<ArticleBlockState[]>(defaultValues?.blocks ?? []);

  // Ensure any newly added languages get a default state entry
  const enrichedLocales = { ...locales };
  for (const locale of activeLocales) {
    if (!enrichedLocales[locale]) {
      enrichedLocales[locale] = defaultLocaleTab();
    }
  }

  const LOCALE_COMPLETENESS_MESSAGE = 'At least one language must have both a title and slug filled.';

  const allErrors = useMemo(() => {
    const localeErr = hasAtLeastOneCompleteLocale(enrichedLocales)
      ? []
      : [LOCALE_COMPLETENESS_MESSAGE];
    const currentValues: ArticleEditorFormValues = {
      status, tags, author, cover_image_url: coverImageUrl, category_id: categoryId, locales: enrichedLocales, blocks,
    };
    const ruleErrs = (validationRules ?? [])
      .map((rule) => rule(currentValues))
      .filter((msg): msg is string => msg !== null);
    return [...localeErr, ...ruleErrs];
  }, [enrichedLocales, validationRules, blocks, status, tags, author, coverImageUrl, categoryId]);

  const isSubmitDisabled = isSubmitting || allErrors.length > 0;

  function handleLocaleChange(locale: string, patch: Partial<ArticleLocaleTabState>) {
    setLocales((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? defaultLocaleTab()), ...patch } }));
  }

  function buildValues(): ArticleEditorFormValues {
    return { status, tags, author, cover_image_url: coverImageUrl, category_id: categoryId, locales: enrichedLocales, blocks };
  }

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  function handleSaveDraft(e: React.MouseEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    if (onSaveDraft) onSaveDraft(buildValues());
    else onSubmit(buildValues());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  const displayTitle = title ?? (enrichedLocales[defaultLocale]?.title?.trim() || 'New article');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Title + action buttons */}
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800 truncate">{displayTitle}</h1>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={status} onChange={setStatus} disabled={isSubmitting} />

          {onDelete && (
            <Button
              variant="outline"
              type="button"
              onClick={onDelete}
              disabled={isSubmitting}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 size={14} aria-hidden="true" /> Delete
            </Button>
          )}

          {onCancel && (
            <Button
              variant="outline"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="gap-1.5"
            >
              <X size={14} aria-hidden="true" /> Cancel
            </Button>
          )}

          {onSaveDraft && (
            <Button
              variant="outline"
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitDisabled}
              className="gap-1.5"
            >
              <Save size={14} aria-hidden="true" />
              {isSubmitting ? 'Saving…' : 'Save draft'}
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitDisabled}
                    className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Plus size={14} aria-hidden="true" />
                    {isSubmitting ? 'Publishing…' : 'Publish'}
                  </Button>
                </span>
              </TooltipTrigger>
              {isSubmitDisabled && allErrors.length > 0 && (
                <TooltipContent>
                  <p>{allErrors[0]}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* Left: language tabs */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue={defaultLocale}>
            <TabsList variant="line" className="w-full justify-start">
              {activeLocales.map((locale) => {
                const localeState = enrichedLocales[locale] ?? defaultLocaleTab();
                const isComplete = localeState.title.trim().length > 0 && localeState.slug.trim().length > 0;
                return (
                  <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                        isComplete ? 'bg-green-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    {localeLabels[locale] ?? locale}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {activeLocales.map((locale) => (
              <TabsContent key={locale} value={locale}>
                <LocaleTabContent
                  locale={locale as ArticleLocale}
                  state={enrichedLocales[locale] ?? defaultLocaleTab()}
                  blocks={blocks}
                  isSubmitting={isSubmitting}
                  onLocaleChange={(patch) => handleLocaleChange(locale, patch)}
                  onBlocksChange={setBlocks}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Right: sidebar */}
        <div className="w-[360px] shrink-0">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Tabs defaultValue="details">
              <TabsList
                variant="line"
                className="w-full justify-start px-4 border-b border-slate-100 rounded-none bg-transparent h-auto"
              >
                <TabsTrigger variant="line" value="details" className="text-sm">Details</TabsTrigger>
                <TabsTrigger variant="line" value="images" className="text-sm">Images</TabsTrigger>
                <TabsTrigger variant="line" value="seo" className="text-sm">SEO</TabsTrigger>
              </TabsList>

              {/* Details tab */}
              <TabsContent value="details" className="p-4 space-y-4 mt-0">
                {/* Author */}
                <div className="space-y-1.5">
                  <Label htmlFor="article-author">Author</Label>
                  <Input
                    id="article-author"
                    placeholder="e.g. Jane Doe"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Tags */}
                <ChipInput
                  label="Tags"
                  chips={tags}
                  onChange={setTags}
                  placeholder="Add tag…"
                  disabled={isSubmitting}
                />
              </TabsContent>

              {/* Images tab */}
              <TabsContent value="images" className="p-4 mt-0 space-y-3">
                <div className="space-y-1.5">
                  <Label>Cover Image</Label>
                  <CoverImageUpload
                    value={coverImageUrl}
                    onChange={setCoverImageUrl}
                    disabled={isSubmitting}
                  />
                </div>
              </TabsContent>

              {/* SEO tab — per locale */}
              <TabsContent value="seo" className="p-4 mt-0">
                <Tabs defaultValue={defaultLocale}>
                  <TabsList variant="line" className="w-full justify-start mb-4">
                    {activeLocales.map((locale) => (
                      <TabsTrigger key={locale} value={locale} variant="line" className="text-xs">
                        {localeLabels[locale] ?? locale}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {activeLocales.map((locale) => {
                    const localeState = enrichedLocales[locale] ?? defaultLocaleTab();
                    return (
                    <TabsContent key={locale} value={locale} className="space-y-4 mt-0">
                      <div className="space-y-1.5">
                        <Label htmlFor={`seo-title-${locale}`} className="text-xs text-slate-500">
                          SEO Title
                        </Label>
                        <Input
                          id={`seo-title-${locale}`}
                          value={localeState.seoTitle}
                          onChange={(e) =>
                            handleLocaleChange(locale, {
                              seoTitle: e.target.value.slice(0, SEO_TITLE_MAX),
                            })
                          }
                          placeholder="SEO title…"
                          disabled={isSubmitting}
                          className="text-sm"
                        />
                        <p className="text-xs text-slate-400 text-right">
                          {localeState.seoTitle.length}/{SEO_TITLE_MAX}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor={`seo-desc-${locale}`} className="text-xs text-slate-500">
                          SEO Description
                        </Label>
                        <Textarea
                          id={`seo-desc-${locale}`}
                          value={localeState.seoDescription}
                          onChange={(e) =>
                            handleLocaleChange(locale, {
                              seoDescription: e.target.value.slice(0, SEO_DESC_MAX),
                            })
                          }
                          placeholder="SEO description…"
                          disabled={isSubmitting}
                          rows={4}
                          className="text-sm resize-none"
                        />
                        <p className="text-xs text-slate-400 text-right">
                          {localeState.seoDescription.length}/{SEO_DESC_MAX}
                        </p>
                      </div>
                    </TabsContent>
                    );
                  })}
                </Tabs>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </form>
  );
}
