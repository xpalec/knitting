'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Save, Trash2, X, Upload } from 'lucide-react';
import type { CategoryType, CategoryStatus, CategoryTranslationStatus, AdminCategory } from '@/lib/api/categories';
import { APP_COLORS, APP_COLOR_LIST, colorSlotFromBg } from '@/lib/colors';
import { hasAtLeastOneCompleteLocale } from '@/lib/validation';
import { useLanguages } from '@/hooks/useLanguages';

// ---------------------------------------------------------------------------
// Constants (kept for backward compatibility — dynamic list comes from store)
// ---------------------------------------------------------------------------

/** @deprecated Use useLanguages() hook instead. Kept for TypeScript type compatibility. */
export const SUPPORTED_LOCALES = ['en', 'pl', 'fr', 'de', 'no'] as const;
export type SupportedLocale = string;

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'abbreviation', label: 'Abbreviation' },
  { value: 'article', label: 'Article' },
];

const STATUS_OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

// Color palette — sourced from central lib/colors.ts
// The bg hex is what gets stored on the Category record.
export const CATEGORY_COLOR_PALETTE = APP_COLOR_LIST.map((c) => c.bg) as string[];

const NO_PARENT = '__none__';
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
// Helper: is a locale tab "translated" (has both name and slug filled in)
// ---------------------------------------------------------------------------

function isLocaleTranslated(state: LocaleTabState): boolean {
  return state.name.trim().length > 0 && state.slug.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocaleTabState {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  short_description: string;
  description: unknown | null; // TipTap JSON or null
  seo_title: string;
  seo_description: string;
  status: CategoryTranslationStatus;
}

export interface CategoryFormValues {
  // Language-independent
  type: CategoryType | '';
  parent_id: string | null;
  color: string;
  status: CategoryStatus;
  // Per-locale
  locales: Record<string, LocaleTabState>;
}

interface CategoryFormProps {
  defaultValues?: Partial<CategoryFormValues>;
  parentCategories?: AdminCategory[];
  isLoadingParents?: boolean;
  onSubmit: (values: CategoryFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  slugErrors?: Partial<Record<string, string>>;
  onCancel?: () => void;
  onDelete?: () => void;
  /** Header title — the category name displayed below the action buttons */
  title?: string;
}

// ---------------------------------------------------------------------------
// Default locale tab state
// ---------------------------------------------------------------------------

function defaultLocaleTab(): LocaleTabState {
  return {
    name: '',
    slug: '',
    slugManuallyEdited: false,
    short_description: '',
    description: null,
    seo_title: '',
    seo_description: '',
    status: 'draft',
  };
}

function buildDefaultLocales(
  activeLocales: string[],
  partial?: Partial<CategoryFormValues>,
): Record<string, LocaleTabState> {
  const defaults: Partial<Record<string, LocaleTabState>> = partial?.locales ?? {};
  const result: Record<string, LocaleTabState> = {};
  for (const locale of activeLocales) {
    const existing = defaults[locale];
    result[locale] = {
      ...defaultLocaleTab(),
      ...(existing ?? {}),
      slugManuallyEdited: Boolean(existing?.slug),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Helper — display name for parent category option
// ---------------------------------------------------------------------------

function getCategoryDisplayName(cat: AdminCategory): string {
  const en = cat.translations.find((t) => t.locale === 'en');
  return en?.name ?? cat.id;
}

// ---------------------------------------------------------------------------
// Color picker — rounded-rectangle swatches
// ---------------------------------------------------------------------------

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category color">
      {APP_COLOR_LIST.map((slot) => {
        const isSelected = colorSlotFromBg(value).bg === slot.bg;
        return (
          <button
            key={slot.bg}
            type="button"
            disabled={disabled}
            onClick={() => onChange(slot.bg)}
            aria-label={slot.label}
            aria-checked={isSelected}
            role="radio"
            title={slot.label}
            className={cn(
              'relative h-8 w-8 rounded-md border-2 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
              isSelected
                ? 'scale-105 shadow-sm'
                : 'border-transparent hover:border-slate-300',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
            style={{
              backgroundColor: slot.bg,
              borderColor: isSelected ? slot.fg : undefined,
            }}
          >
            {isSelected && (
              <svg
                viewBox="0 0 12 12"
                fill="none"
                className="absolute inset-0 m-auto h-3 w-3"
                aria-hidden="true"
              >
                <path
                  d="M2 6l3 3 5-5"
                  stroke={slot.fg}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Locale tab content (left column)
// ---------------------------------------------------------------------------

interface LocaleTabProps {
  locale: string;
  state: LocaleTabState;
  onChange: (locale: string, patch: Partial<LocaleTabState>) => void;
  isSubmitting: boolean;
  slugError?: string;
}

function LocaleTabContent({ locale, state, onChange, isSubmitting, slugError }: LocaleTabProps) {
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    const patch: Partial<LocaleTabState> = { name: newName };
    if (!state.slugManuallyEdited) {
      patch.slug = toSlug(newName);
    }
    onChange(locale, patch);
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange(locale, { slug: e.target.value, slugManuallyEdited: true });
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Card 1: Name + Slug + Short description */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        {/* Name + Slug side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${locale}`}>
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`name-${locale}`}
              placeholder="Enter category name"
              value={state.name}
              onChange={handleNameChange}
              disabled={isSubmitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`slug-${locale}`}>
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`slug-${locale}`}
              placeholder="stockinette-stitch"
              value={state.slug}
              onChange={handleSlugChange}
              disabled={isSubmitting}
              className={cn('font-mono text-slate-400 text-sm', slugError && 'border-red-400')}
            />
            {slugError ? (
              <p className="text-xs text-red-500">{slugError}</p>
            ) : (
              <p className="text-xs text-slate-400">Used in URLs and it&apos;s autogenerated</p>
            )}
            {state.name.trim() && !state.slug.trim() && (
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
            placeholder="Write short description"
            value={state.short_description}
            onChange={(e) => onChange(locale, { short_description: e.target.value })}
            disabled={isSubmitting}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      {/* Card 2: Description (TipTap) */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <Label>
          Description <span className="text-red-500">*</span>
        </Label>
        <RichTextEditor
          value={state.description}
          onChange={(json) => onChange(locale, { description: json })}
          placeholder="Write description"
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function CategoryForm({
  defaultValues,
  parentCategories = [],
  isLoadingParents = false,
  onSubmit,
  isSubmitting = false,
  slugErrors = {},
  onCancel,
  onDelete,
  title,
}: CategoryFormProps) {
  const { allLocales, defaultLanguage, getLocaleLabel } = useLanguages();

  // Include store locales + any locales present in defaultValues (e.g. during tests
  // or when pre-loaded data has locales not yet added to the store).
  const defaultValueLocales = Object.keys(defaultValues?.locales ?? {});
  const mergedLocales = Array.from(new Set([...allLocales, ...defaultValueLocales]));
  const activeLocales = mergedLocales.length > 0 ? mergedLocales : ['en'];
  const defaultLocale = defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  const [type, setType] = useState<CategoryType | ''>(defaultValues?.type ?? '');
  const [parentId, setParentId] = useState<string | null>(defaultValues?.parent_id ?? null);
  const [color, setColor] = useState<string>(
    defaultValues?.color ?? APP_COLORS.violet.bg,
  );
  const [status, setStatus] = useState<CategoryStatus>(defaultValues?.status ?? 'draft');
  const [locales, setLocales] = useState<Record<string, LocaleTabState>>(
    () => buildDefaultLocales(activeLocales, defaultValues),
  );

  // Ensure any newly added languages get a default state entry (non-destructive)
  const enrichedLocales = { ...locales };
  for (const locale of activeLocales) {
    if (!enrichedLocales[locale]) {
      enrichedLocales[locale] = defaultLocaleTab();
    }
  }

  const localeValid = hasAtLeastOneCompleteLocale(enrichedLocales);
  const isSubmitDisabled = isSubmitting || !localeValid || !type;

  const localeErrors: string[] = localeValid
    ? []
    : ['At least one language must have both a name and slug filled.'];

  function handleLocaleChange(locale: string, patch: Partial<LocaleTabState>) {
    setLocales((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] ?? defaultLocaleTab()), ...patch },
    }));
  }

  function buildValues(overrideStatus?: CategoryStatus): CategoryFormValues {
    return {
      type: type as CategoryType,
      parent_id: parentId,
      color,
      status: overrideStatus ?? status,
      locales: enrichedLocales,
    };
  }

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  const displayTitle = title ?? (enrichedLocales[defaultLocale]?.name?.trim() || 'New category');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Title + action buttons row ──────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">{displayTitle}</h1>

        <div className="flex items-center gap-2">
          {/* Status pill */}
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border select-none',
            status === 'published'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              status === 'published' ? 'bg-green-500' : 'bg-amber-500',
            )} />
            {status === 'published' ? 'Published' : 'Draft'}
          </div>

          {/* Import — always present, muted */}
          <Button
            variant="outline"
            type="button"
            disabled
            className="gap-2 text-slate-400 border-slate-200"
          >
            <Upload size={15} aria-hidden="true" />
            Import
          </Button>

          {/* Delete — only shown when onDelete is provided */}
          {onDelete && (
            <Button
              variant="outline"
              type="button"
              onClick={onDelete}
              disabled={isSubmitting}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </Button>
          )}

          {/* Cancel */}
          {onCancel && (
            <Button
              variant="outline"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="gap-2"
            >
              <X size={15} aria-hidden="true" />
              Cancel
            </Button>
          )}

          {/* Save */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isSubmitDisabled}
                    className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Save size={15} aria-hidden="true" />
                    {isSubmitting ? 'Saving…' : 'Save'}
                  </Button>
                </span>
              </TooltipTrigger>
              {isSubmitDisabled && localeErrors.length > 0 && (
                <TooltipContent>
                  <p>{localeErrors[0]}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: language tabs ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue={defaultLocale}>
            {/* Tab triggers — language name only, with translation dot indicator */}
            <TabsList variant="line" className="w-full justify-start">
              {activeLocales.map((locale) => {
                const translated = isLocaleTranslated(enrichedLocales[locale] ?? defaultLocaleTab());
                return (
                  <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                    {/* Dot: green when translated, transparent placeholder when not */}
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                        translated ? 'bg-green-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    <span>{getLocaleLabel(locale)}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {activeLocales.map((locale) => (
              <TabsContent key={locale} value={locale}>
                <LocaleTabContent
                  locale={locale}
                  state={enrichedLocales[locale] ?? defaultLocaleTab()}
                  onChange={handleLocaleChange}
                  isSubmitting={isSubmitting}
                  slugError={slugErrors[locale]}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ── Right: sidebar ──────────────────────────────────────────── */}
        <div className="w-[380px] shrink-0 space-y-4">

          {/* Card: Status + Type + Parent + Color */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="category-status">
                Status <span className="text-red-500">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CategoryStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="category-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label htmlFor="category-type">
                Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as CategoryType)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="category-type">
                  <SelectValue placeholder="Select a type…" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Parent category */}
            <div className="space-y-1.5">
              <Label htmlFor="category-parent">
                Parent category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={parentId ?? NO_PARENT}
                onValueChange={(v) => setParentId(v === NO_PARENT ? null : v)}
                disabled={isSubmitting || isLoadingParents}
              >
                <SelectTrigger id="category-parent">
                  <SelectValue placeholder={isLoadingParents ? 'Loading…' : 'Top Level Category'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Top Level Category</SelectItem>
                  {parentCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {getCategoryDisplayName(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>
                Color <span className="text-red-500">*</span>
              </Label>
              <ColorPicker value={color} onChange={setColor} disabled={isSubmitting} />
            </div>
          </div>

          {/* Card: SEO section */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700">SEO</p>

            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">SEO Title</p>
              <Input
                id="seo-title-en"
                placeholder="SEO title"
                value={enrichedLocales[defaultLocale]?.seo_title ?? ''}
                onChange={(e) => handleLocaleChange(defaultLocale, {
                  seo_title: e.target.value.slice(0, SEO_TITLE_MAX),
                })}
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">SEO Description</p>
              <Textarea
                id="seo-desc-en"
                placeholder="SEO description"
                value={enrichedLocales[defaultLocale]?.seo_description ?? ''}
                onChange={(e) => handleLocaleChange(defaultLocale, {
                  seo_description: e.target.value.slice(0, SEO_DESC_MAX),
                })}
                disabled={isSubmitting}
                rows={5}
                className="text-sm resize-none"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
