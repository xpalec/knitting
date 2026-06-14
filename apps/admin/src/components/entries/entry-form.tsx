'use client';

import { useState, useMemo } from 'react';
import {
  Save, Trash2, X, Upload, ChevronDown, ChevronUp,
  GripVertical, MoreHorizontal, Plus, Check, ChevronsUpDown,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { EntryStatus } from '@/lib/api/entries';
import type { AdminCategory } from '@/lib/api/categories';
import type { EntryTemplate } from '@/lib/api/entry-templates';
import type { ContentBlockType } from '@/lib/api/content-block-types';
import { hasAtLeastOneCompleteLocale, type ValidationRule } from '@/lib/validation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SUPPORTED_LOCALES = ['en', 'pl', 'fr', 'de'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  pl: 'Polish',
  fr: 'French',
  de: 'German',
};

const SEO_TITLE_MAX = 60;
const SEO_DESC_MAX = 160;

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlockEditorState {
  _id: string;          // local React key
  blockId: string;      // stable template block UUID — used as key in Translation.blocks
  type: string;
  label: string;        // per-block custom name from the template
  heading: string;
  headingManuallyEdited: boolean;
  content: unknown | null;
  visible: boolean;
  required: boolean;
  order: number;
}

export interface LocaleTabState {
  title: string;
  slug: string;
  slugManuallyEdited: boolean;
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
  blocks: BlockEditorState[];
}

export interface EntryFormValues {
  entryTemplateId: string;
  categoryId: string;
  status: EntryStatus;
  synonyms: string[];
  tags: string[];
  abbreviations: string[];
  locales: Record<SupportedLocale, LocaleTabState>;
}

export interface EntryFormProps {
  defaultValues?: Partial<EntryFormValues>;
  categories?: AdminCategory[];
  isLoadingCategories?: boolean;
  templates?: EntryTemplate[];
  isLoadingTemplates?: boolean;
  contentBlockTypes?: ContentBlockType[];
  isLoadingContentBlockTypes?: boolean;
  onSubmit: (values: EntryFormValues) => void | Promise<void>;
  onSaveDraft?: (values: EntryFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  title?: string;
  validationRules?: ValidationRule<EntryFormValues>[];
}

// ---------------------------------------------------------------------------
// Default state builders
// ---------------------------------------------------------------------------

let _idCounter = 0;
function nextId() { return `b-${++_idCounter}`; }

function defaultLocaleTab(): LocaleTabState {
  return {
    title: '',
    slug: '',
    slugManuallyEdited: false,
    shortDescription: '',
    seoTitle: '',
    seoDescription: '',
    blocks: [],
  };
}

function buildDefaultLocales(
  partial?: Partial<EntryFormValues>,
): Record<SupportedLocale, LocaleTabState> {
  const result = {} as Record<SupportedLocale, LocaleTabState>;
  for (const locale of SUPPORTED_LOCALES) {
    result[locale] = {
      ...defaultLocaleTab(),
      ...(partial?.locales?.[locale] ?? {}),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Combobox field (searchable select)
// ---------------------------------------------------------------------------

interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxFieldProps {
  id: string;
  label: string;
  required?: boolean;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

function ComboboxField({
  id,
  label,
  required,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found.',
  disabled,
  isLoading,
}: ComboboxFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled || isLoading}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            className={cn(
              'flex w-full items-center justify-between rounded-md border border-slate-200 bg-white',
              'px-3 py-2 text-sm text-left shadow-xs transition-colors',
              'hover:border-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400',
              'disabled:cursor-not-allowed disabled:opacity-50',
              !selected && 'text-slate-400',
            )}
          >
            <span className="truncate">
              {isLoading ? 'Loading…' : (selected?.label ?? placeholder)}
            </span>
            <ChevronsUpDown size={14} className="shrink-0 text-slate-400 ml-2" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
          sideOffset={4}
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <Check
                      size={14}
                      className={cn(
                        'shrink-0 transition-opacity',
                        value === opt.value ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-slate-400 font-mono shrink-0">{opt.sublabel}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chip input (synonyms / tags / abbreviations)
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

  function remove(chip: string) {
    onChange(chips.filter((c) => c !== chip));
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">
        {label} <span className="text-red-500">*</span>
      </Label>
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
                onClick={() => remove(chip)}
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
            if (e.key === 'Backspace' && !input && chips.length) {
              onChange(chips.slice(0, -1));
            }
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
// Block editor row — rich text block
// ---------------------------------------------------------------------------

// Color palette matching BlockTypeBadge
const BLOCK_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  rich_text:  { bg: '#EDE7FF', fg: '#7F6BBF' },
  callout:    { bg: '#FEF3C7', fg: '#B45309' },
  steps:      { bg: '#DCFCE7', fg: '#16A34A' },
  key_facts:  { bg: '#E0F2FE', fg: '#0369A1' },
  video:      { bg: '#FFE4E6', fg: '#BE123C' },
  image:      { bg: '#FEF9C3', fg: '#A16207' },
  relations:  { bg: '#FFEDD5', fg: '#C2410C' },
  pattern:    { bg: '#F0FDF4', fg: '#15803D' },
};
const BLOCK_TYPE_FALLBACK = { bg: '#EEEEF2', fg: '#8B8FA8' };

interface BlockRowProps {
  block: BlockEditorState;
  blockTypes?: ContentBlockType[];
  isSubmitting?: boolean;
  onChange: (patch: Partial<BlockEditorState>) => void;
  onRemove: () => void;
}

function BlockRow({ block, blockTypes, isSubmitting, onChange, onRemove }: BlockRowProps) {
  const [expanded, setExpanded] = useState(true);

  // Resolve registered block type for label + color
  const registeredType = blockTypes?.find((bt) => bt.type === block.type);
  const displayLabel = block.label || registeredType?.label || block.type;
  const typeLabel = registeredType?.label ?? block.type;
  const typeColor = BLOCK_TYPE_COLORS[block.type] ?? BLOCK_TYPE_FALLBACK;
  // Use registered color if present, else fall back to palette
  const swatchBg = registeredType?.color ?? typeColor.bg;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-white">

        {/* Drag handle */}
        <GripVertical size={15} className="text-slate-300 shrink-0 cursor-grab" aria-hidden="true" />

        {/* Color swatch + block name/type */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span
            className="h-5 w-5 rounded shrink-0"
            style={{ backgroundColor: swatchBg }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-700 truncate leading-tight">{displayLabel}</p>
            <p className="text-[10px] text-slate-400 leading-tight">{typeLabel}</p>
          </div>
        </div>

        {/* Required / Optional clickable badge */}
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
            : <ChevronDown size={15} aria-hidden="true" />
          }
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

      {/* ── Editor body ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 pt-3 pb-4 space-y-3">
          {/* Header input — sits above the editor, matching the design */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Header</label>
            <Input
              value={block.heading}
              onChange={(e) => onChange({ heading: e.target.value, headingManuallyEdited: true })}
              placeholder="English header text can be changed"
              disabled={isSubmitting}
              className="h-8 text-sm"
            />
          </div>
          <RichTextEditor
            value={block.content}
            onChange={(json) => onChange({ content: json })}
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
  locale: SupportedLocale;
  state: LocaleTabState;
  contentBlockTypes?: ContentBlockType[];
  isSubmitting: boolean;
  onChange: (patch: Partial<LocaleTabState>) => void;
}

function LocaleTabContent({
  locale,
  state,
  contentBlockTypes,
  isSubmitting,
  onChange,
}: LocaleTabContentProps) {
  function handleTitleChange(value: string) {
    const patch: Partial<LocaleTabState> = { title: value };
    if (!state.slugManuallyEdited) patch.slug = toSlug(value);
    onChange(patch);
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Title + Slug + Short description */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor={`title-${locale}`}>
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`title-${locale}`}
              placeholder="Entry title"
              value={state.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor={`slug-${locale}`}>
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`slug-${locale}`}
              placeholder="entry-title"
              value={state.slug}
              onChange={(e) => onChange({ slug: e.target.value, slugManuallyEdited: true })}
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

        {/* Short description */}
        <div className="space-y-1.5">
          <Label htmlFor={`short-desc-${locale}`}>
            Short description <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id={`short-desc-${locale}`}
            placeholder="A brief description of this entry…"
            value={state.shortDescription}
            onChange={(e) => onChange({ shortDescription: e.target.value })}
            disabled={isSubmitting}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      {/* Content blocks section */}
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
              const newBlock: BlockEditorState = {
                _id: nextId(),
                blockId: nextId(), // no template slot yet; will be assigned on save
                type: 'rich_text',
                label: 'Rich Text',
                heading: '',
                headingManuallyEdited: false,
                content: null,
                visible: true,
                required: false,
                order: state.blocks.length + 1,
              };
              onChange({ blocks: [...state.blocks, newBlock] });
            }}
          >
            <Plus size={13} aria-hidden="true" />
            Add block
          </Button>
        </div>

        {state.blocks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            No content blocks yet. Add a block to start editing content.
          </div>
        ) : (
          <div className="space-y-3">
            {state.blocks.map((block) => (
              <BlockRow
                key={block._id}
                block={block}
                blockTypes={contentBlockTypes}
                isSubmitting={isSubmitting}
                onChange={(patch) =>
                  onChange({
                    blocks: state.blocks.map((b) =>
                      b._id === block._id ? { ...b, ...patch } : b
                    ),
                  })
                }
                onRemove={() =>
                  onChange({ blocks: state.blocks.filter((b) => b._id !== block._id) })
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
// Status pill with dropdown
// ---------------------------------------------------------------------------

interface StatusPillProps {
  status: EntryStatus;
  onChange: (status: EntryStatus) => void;
  disabled?: boolean;
}

function StatusPill({ status, onChange, disabled }: StatusPillProps) {
  const STATUS_STYLES: Record<EntryStatus, string> = {
    draft:      'bg-slate-100 text-slate-600 border-slate-200',
    review:     'bg-amber-50 text-amber-700 border-amber-200',
    published:  'bg-green-50 text-green-700 border-green-200',
    deprecated: 'bg-red-50 text-red-600 border-red-200',
  };
  const STATUS_DOT: Record<EntryStatus, string> = {
    draft:      'bg-slate-400',
    review:     'bg-amber-500',
    published:  'bg-green-500',
    deprecated: 'bg-red-500',
  };
  const STATUS_LABELS: Record<EntryStatus, string> = {
    draft: 'Draft', review: 'In Review', published: 'Published', deprecated: 'Deprecated',
  };

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
        {(Object.keys(STATUS_LABELS) as EntryStatus[]).map((s) => (
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
// Main EntryForm
// ---------------------------------------------------------------------------

export function EntryForm({
  defaultValues,
  categories,
  isLoadingCategories,
  templates,
  isLoadingTemplates,
  contentBlockTypes,
  isLoadingContentBlockTypes: _isLoadingContentBlockTypes,
  onSubmit,
  onSaveDraft,
  isSubmitting = false,
  onCancel,
  onDelete,
  title,
  validationRules,
}: EntryFormProps) {
  const [entryTemplateId, setEntryTemplateId] = useState(defaultValues?.entryTemplateId ?? '');
  const [categoryId, setCategoryId] = useState(defaultValues?.categoryId ?? '');

  function handleTemplateChange(id: string) {
    setEntryTemplateId(id);
    const tpl = templates?.find((t) => t.id === id);
    if (!tpl) return;
    // Build BlockEditorState[] from the template's block list, per locale so headings are correct
    setLocales((prev) => {
      const next = { ...prev } as typeof prev;
      for (const locale of SUPPORTED_LOCALES) {
        const localeBlocks: BlockEditorState[] = tpl.blocks
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((b, i) => ({
            _id: nextId(),
            blockId: b.id,
            type: b.type,
            label: b.label ?? b.type,
            heading: tpl.translations?.[b.id]?.[locale]?.heading ?? '',
            headingManuallyEdited: false,
            content: null,
            visible: true,
            required: b.required,
            order: i + 1,
          }));
        next[locale] = { ...next[locale], blocks: localeBlocks };
      }
      return next;
    });
  }
  const [status, setStatus] = useState<EntryStatus>(defaultValues?.status ?? 'draft');
  const [synonyms, setSynonyms] = useState<string[]>(defaultValues?.synonyms ?? []);
  const [tags, setTags] = useState<string[]>(defaultValues?.tags ?? []);
  const [abbreviations, setAbbreviations] = useState<string[]>(defaultValues?.abbreviations ?? []);
  const [locales, setLocales] = useState<Record<SupportedLocale, LocaleTabState>>(
    () => buildDefaultLocales(defaultValues),
  );

  const LOCALE_COMPLETENESS_MESSAGE = 'At least one language must have both a title and slug filled.';

  const allErrors = useMemo(() => {
    const localeErr = hasAtLeastOneCompleteLocale(locales)
      ? []
      : [LOCALE_COMPLETENESS_MESSAGE];
    const ruleErrs = (validationRules ?? [])
      .map((rule) => rule(buildValues()))
      .filter((msg): msg is string => msg !== null);
    return [...localeErr, ...ruleErrs];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locales, validationRules]);

  const isSubmitDisabled = isSubmitting || allErrors.length > 0;

  function handleLocaleChange(locale: SupportedLocale, patch: Partial<LocaleTabState>) {
    setLocales((prev) => ({ ...prev, [locale]: { ...prev[locale], ...patch } }));
  }

  function buildValues(): EntryFormValues {
    return { entryTemplateId, categoryId, status, synonyms, tags, abbreviations, locales };
  }

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  function handleSaveDraft(e: React.MouseEvent) {
    e.preventDefault();
    if (onSaveDraft) onSaveDraft(buildValues());
    else onSubmit(buildValues());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  const displayTitle = title ?? (locales.en.title.trim() || 'New entry');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Title + action buttons row ──────────────────────────────── */}
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

          <Button
            variant="outline"
            type="button"
            disabled
            className="gap-1.5 text-slate-400 border-slate-200"
          >
            <Upload size={14} aria-hidden="true" />
            Import
          </Button>

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

      {/* ── Two-column layout ─────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: language tabs ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="en">
            <TabsList variant="line" className="w-full justify-start">
              {SUPPORTED_LOCALES.map((locale) => {
                const isComplete = locales[locale].title.trim().length > 0 && locales[locale].slug.trim().length > 0;
                return (
                  <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                        isComplete ? 'bg-green-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    {LOCALE_LABELS[locale]}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {SUPPORTED_LOCALES.map((locale) => (
              <TabsContent key={locale} value={locale}>
                <LocaleTabContent
                  locale={locale}
                  state={locales[locale]}
                  contentBlockTypes={contentBlockTypes}
                  isSubmitting={isSubmitting}
                  onChange={(patch) => handleLocaleChange(locale, patch)}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ── Right: sidebar ────────────────────────────────────────── */}
        <div className="w-[480px] shrink-0">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <Tabs defaultValue="details">
              <TabsList variant="line" className="w-full justify-start px-4 border-b border-slate-100 rounded-none bg-transparent h-auto">
                <TabsTrigger variant="line" value="details" className="text-sm">Details</TabsTrigger>
                <TabsTrigger variant="line" value="images" className="text-sm">Images</TabsTrigger>
                <TabsTrigger variant="line" value="seo" className="text-sm">SEO</TabsTrigger>
              </TabsList>

              {/* Details tab */}
              <TabsContent value="details" className="p-4 space-y-4 mt-0">
                {/* Entry template */}
                <ComboboxField
                  id="entry-template-sidebar"
                  label="Entry template"
                  required
                  options={(templates ?? []).map((t) => ({ value: t.id, label: t.name }))}
                  value={entryTemplateId}
                  onChange={handleTemplateChange}
                  placeholder="Select template…"
                  searchPlaceholder="Search templates…"
                  emptyMessage="No templates found."
                  disabled={isSubmitting}
                  isLoading={isLoadingTemplates}
                />

                {/* Category */}
                <ComboboxField
                  id="category-sidebar"
                  label="Category"
                  required
                  options={(categories ?? []).map((cat) => {
                    const en = cat.translations.find((t) => t.locale === 'en');
                    return { value: cat.id, label: en?.name ?? cat.id };
                  })}
                  value={categoryId}
                  onChange={setCategoryId}
                  placeholder="Select category…"
                  searchPlaceholder="Search categories…"
                  emptyMessage="No categories found."
                  disabled={isSubmitting}
                  isLoading={isLoadingCategories}
                />

                <ChipInput
                  label="Synonyms"
                  chips={synonyms}
                  onChange={setSynonyms}
                  placeholder="Add synonym…"
                  disabled={isSubmitting}
                />

                <ChipInput
                  label="Tags"
                  chips={tags}
                  onChange={setTags}
                  placeholder="Add tag…"
                  disabled={isSubmitting}
                />

                <ChipInput
                  label="Abbreviations"
                  chips={abbreviations}
                  onChange={setAbbreviations}
                  placeholder="Add abbreviation…"
                  disabled={isSubmitting}
                />
              </TabsContent>

              {/* Images tab */}
              <TabsContent value="images" className="p-4 mt-0">
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <Upload size={28} aria-hidden="true" />
                  <p className="text-sm">Images coming soon</p>
                </div>
              </TabsContent>

              {/* SEO tab */}
              <TabsContent value="seo" className="p-4 space-y-4 mt-0">
                <div className="space-y-1.5">
                  <Label htmlFor="seo-title-en" className="text-xs text-slate-500">SEO Title</Label>
                  <Input
                    id="seo-title-en"
                    value={locales.en.seoTitle}
                    onChange={(e) =>
                      handleLocaleChange('en', { seoTitle: e.target.value.slice(0, SEO_TITLE_MAX) })
                    }
                    placeholder="SEO title…"
                    disabled={isSubmitting}
                    className="text-sm"
                  />
                  <p className="text-xs text-slate-400 text-right">{locales.en.seoTitle.length}/{SEO_TITLE_MAX}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="seo-desc-en" className="text-xs text-slate-500">SEO Description</Label>
                  <Textarea
                    id="seo-desc-en"
                    value={locales.en.seoDescription}
                    onChange={(e) =>
                      handleLocaleChange('en', { seoDescription: e.target.value.slice(0, SEO_DESC_MAX) })
                    }
                    placeholder="SEO description…"
                    disabled={isSubmitting}
                    rows={4}
                    className="text-sm resize-none"
                  />
                  <p className="text-xs text-slate-400 text-right">{locales.en.seoDescription.length}/{SEO_DESC_MAX}</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </form>
  );
}
