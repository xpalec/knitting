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
import { Save, Trash2, X } from 'lucide-react';
import type { TagTranslationStatus } from '@/lib/api/tags';
import { useLanguages } from '@/hooks/useLanguages';

// ---------------------------------------------------------------------------
// Constants (kept for backward compatibility — dynamic list comes from store)
// ---------------------------------------------------------------------------

/** @deprecated Use useLanguages() hook instead. Kept for TypeScript type compatibility. */
export const SUPPORTED_LOCALES = ['en', 'pl', 'fr', 'de', 'no'] as const;
export type SupportedLocale = string;

const STATUS_OPTIONS: { value: TagTranslationStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft' },
  { value: 'reviewed',  label: 'Reviewed' },
  { value: 'published', label: 'Published' },
];

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

export interface LocaleTabState {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
  description: unknown | null; // TipTap JSON
  seo_title: string;
  seo_description: string;
  status: TagTranslationStatus;
}

export interface TagFormValues {
  locales: Record<string, LocaleTabState>;
}

interface TagFormProps {
  defaultValues?: Partial<TagFormValues>;
  onSubmit: (values: TagFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  slugErrors?: Partial<Record<string, string>>;
  onCancel?: () => void;
  onDelete?: () => void;
  title?: string;
}

// ---------------------------------------------------------------------------
// Default locale state
// ---------------------------------------------------------------------------

function defaultLocaleTab(): LocaleTabState {
  return {
    name: '',
    slug: '',
    slugManuallyEdited: false,
    description: null,
    seo_title: '',
    seo_description: '',
    status: 'published',
  };
}

function buildDefaultLocales(
  activeLocales: string[],
  partial?: Partial<TagFormValues>,
): Record<string, LocaleTabState> {
  const defaults = partial?.locales ?? {} as Partial<Record<string, LocaleTabState>>;
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

function isLocaleTranslated(state: LocaleTabState): boolean {
  return state.name.trim().length > 0;
}

// ---------------------------------------------------------------------------
// Locale tab content (left column — name, slug, description only)
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
      {/* Name + Slug */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor={`name-${locale}`}>
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`name-${locale}`}
              placeholder="e.g. Fair Isle"
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
              placeholder="fair-isle"
              value={state.slug}
              onChange={handleSlugChange}
              disabled={isSubmitting}
              className={cn('font-mono text-slate-400 text-sm', slugError && 'border-red-400')}
            />
            {slugError ? (
              <p className="text-xs text-red-500">{slugError}</p>
            ) : (
              <p className="text-xs text-slate-400">Used in URLs — auto-generated from name</p>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <Label>Description</Label>
        <RichTextEditor
          value={state.description}
          onChange={(json) => onChange(locale, { description: json })}
          placeholder="Write a description for this tag"
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function TagForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  slugErrors = {},
  onCancel,
  onDelete,
  title,
}: TagFormProps) {
  const { allLocales, localeLabels, defaultLanguage } = useLanguages();

  const [locales, setLocales] = useState<Record<string, LocaleTabState>>(
    () => buildDefaultLocales(allLocales, defaultValues),
  );

  // When language settings change, ensure new locales have default state entries
  const activeLocales = allLocales.length > 0 ? allLocales : ['en'];

  // Sync locales state when activeLocales changes (new languages added in settings)
  const enrichedLocales = { ...locales };
  for (const locale of activeLocales) {
    if (!enrichedLocales[locale]) {
      enrichedLocales[locale] = defaultLocaleTab();
    }
  }

  // Drive the status pill from the default locale.
  const defaultLocale = defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  const isSubmitDisabled = isSubmitting || !(enrichedLocales[defaultLocale]?.name?.trim());

  function handleLocaleChange(locale: string, patch: Partial<LocaleTabState>) {
    setLocales((prev) => ({ ...prev, [locale]: { ...(prev[locale] ?? defaultLocaleTab()), ...patch } }));
  }

  function buildValues(): TagFormValues {
    return { locales: enrichedLocales };
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

  const displayTitle = title ?? ((enrichedLocales[defaultLocale]?.name?.trim()) || 'New tag');

  // Active locale tracked via Tabs — needed to wire the sidebar status/SEO
  // to the correct locale. We use a controlled tab and expose a setter.
  const [activeLocale, setActiveLocale] = useState<string>(defaultLocale);
  const activeState = enrichedLocales[activeLocale] ?? defaultLocaleTab();

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Title + action buttons row ──────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">{displayTitle}</h1>

        <div className="flex items-center gap-2">
          {/* Status pill — reflects active locale */}
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border select-none',
            activeState.status === 'published'
              ? 'bg-green-50 text-green-700 border-green-200'
              : activeState.status === 'reviewed'
              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
              : 'bg-amber-50 text-amber-700 border-amber-200',
          )}>
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              activeState.status === 'published' ? 'bg-green-500'
              : activeState.status === 'reviewed' ? 'bg-yellow-500'
              : 'bg-amber-500',
            )} />
            {activeState.status === 'published' ? 'Published'
              : activeState.status === 'reviewed' ? 'Reviewed'
              : 'Draft'}
          </div>

          {onDelete && (
            <Button
              variant="outline"
              type="button"
              onClick={onDelete}
              disabled={isSubmitting}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </Button>
          )}
          {onCancel && (
            <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting} className="gap-2">
              <X size={15} aria-hidden="true" /> Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitDisabled}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Save size={15} aria-hidden="true" />
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: locale tabs ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Tabs
            value={activeLocale}
            onValueChange={(v) => setActiveLocale(v as string)}
          >
            <TabsList variant="line" className="w-full justify-start">
              {activeLocales.map((locale) => {
                const translated = isLocaleTranslated(enrichedLocales[locale] ?? defaultLocaleTab());
                return (
                  <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                        translated ? 'bg-green-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    <span>{localeLabels[locale] ?? locale}</span>
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

        {/* ── Right: sidebar ─────────────────────────────────────── */}
        <div className="w-[380px] shrink-0 space-y-4">

          {/* Status card — scoped to active locale */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tag-status">
                Status <span className="text-xs text-slate-400">({localeLabels[activeLocale] ?? activeLocale})</span>
              </Label>
              <Select
                value={activeState.status}
                onValueChange={(v) => handleLocaleChange(activeLocale, { status: v as TagTranslationStatus })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="tag-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SEO card — scoped to active locale */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
            <p className="text-sm font-semibold text-slate-700">SEO</p>

            <div className="space-y-1.5">
              <Label htmlFor="seo-title">
                SEO Title
                <span className="ml-1 text-xs text-slate-400">(≤{SEO_TITLE_MAX})</span>
              </Label>
              <Input
                id="seo-title"
                placeholder="e.g. Fair Isle Knitting — Encyclopedia"
                value={activeState.seo_title}
                onChange={(e) => handleLocaleChange(activeLocale, {
                  seo_title: e.target.value.slice(0, SEO_TITLE_MAX),
                })}
                disabled={isSubmitting}
                className="text-sm"
              />
              <p className="text-xs text-slate-400">
                {activeState.seo_title.length}/{SEO_TITLE_MAX} — falls back to name if empty
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo-desc">
                SEO Description
                <span className="ml-1 text-xs text-slate-400">(≤{SEO_DESC_MAX})</span>
              </Label>
              <Textarea
                id="seo-desc"
                placeholder="e.g. Explore Fair Isle knitting terms, techniques, and traditions."
                value={activeState.seo_description}
                onChange={(e) => handleLocaleChange(activeLocale, {
                  seo_description: e.target.value.slice(0, SEO_DESC_MAX),
                })}
                disabled={isSubmitting}
                rows={4}
                className="resize-none text-sm"
              />
              <p className="text-xs text-slate-400">
                {activeState.seo_description.length}/{SEO_DESC_MAX}
              </p>
            </div>
          </div>

        </div>
      </div>
    </form>
  );
}
