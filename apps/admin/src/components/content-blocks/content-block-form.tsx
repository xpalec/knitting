'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { APP_COLOR_LIST, APP_COLORS, colorSlotFromBg } from '@/lib/colors';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  BLOCK_TYPE_OPTIONS,
  type Locale,
} from '@/lib/api/content-block-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentBlockFormLocaleState {
  heading: string;
}

export interface ContentBlockFormValues {
  label: string;
  type: string;
  color: string;
  locales: Record<Locale, ContentBlockFormLocaleState>;
}

interface ContentBlockFormProps {
  defaultValues?: Partial<ContentBlockFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: ContentBlockFormValues) => void | Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
  title?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultLocale(): ContentBlockFormLocaleState {
  return { heading: '' };
}

function buildDefaultLocales(partial?: Partial<ContentBlockFormValues>): Record<Locale, ContentBlockFormLocaleState> {
  const result = {} as Record<Locale, ContentBlockFormLocaleState>;
  for (const locale of SUPPORTED_LOCALES) {
    result[locale] = { ...defaultLocale(), ...(partial?.locales?.[locale] ?? {}) };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Color picker — reused from CategoryForm pattern
// ---------------------------------------------------------------------------

function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (c: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Block color">
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
              isSelected ? 'scale-105 shadow-sm' : 'border-transparent hover:border-slate-300',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
            style={{ backgroundColor: slot.bg, borderColor: isSelected ? slot.fg : undefined }}
          >
            {isSelected && (
              <svg viewBox="0 0 12 12" fill="none" className="absolute inset-0 m-auto h-3 w-3" aria-hidden="true">
                <path d="M2 6l3 3 5-5" stroke={slot.fg} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-locale tab content
// ---------------------------------------------------------------------------

function LocaleTabContent({
  locale,
  state,
  blockLabel,
  blockColor,
  onChange,
  disabled,
}: {
  locale: Locale;
  state: ContentBlockFormLocaleState;
  blockLabel: string;
  blockColor: string;
  onChange: (patch: Partial<ContentBlockFormLocaleState>) => void;
  disabled: boolean;
}) {
  const colorSlot = colorSlotFromBg(blockColor);

  return (
    <div className="space-y-4 pt-4">
      {/* Preview card — header input sits above the editor, inside the same card */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        {/* Block header row */}
        <div
          className="flex items-center gap-3 rounded-md px-4 py-2.5"
          style={{ backgroundColor: colorSlot.bg }}
        >
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: colorSlot.fg }}
            aria-hidden="true"
          />
          <span className="text-sm font-medium" style={{ color: colorSlot.fg }}>
            {state.heading || blockLabel || 'Block Name'}
          </span>
        </div>

        {/* Header input */}
        <div className="space-y-1.5">
          <Label htmlFor={`heading-${locale}`}>Header</Label>
          <Input
            id={`heading-${locale}`}
            value={state.heading}
            onChange={(e) => onChange({ heading: e.target.value })}
            placeholder={`${LOCALE_LABELS[locale]} header text can be changed`}
            disabled={disabled}
          />
        </div>

        {/* TipTap editor */}
        <RichTextEditor
          placeholder="Write content here…"
          disabled
          className="min-h-[120px]"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function ContentBlockForm({
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  onDelete,
  title,
}: ContentBlockFormProps) {
  const [label, setLabel] = useState(defaultValues?.label ?? '');
  const [type, setType] = useState(defaultValues?.type ?? '');
  const [color, setColor] = useState(defaultValues?.color ?? APP_COLORS.violet.bg);
  const [locales, setLocales] = useState<Record<Locale, ContentBlockFormLocaleState>>(
    () => buildDefaultLocales(defaultValues),
  );

  const isSubmitDisabled = isSubmitting || !label.trim() || !type;

  function handleLocaleChange(locale: Locale, patch: Partial<ContentBlockFormLocaleState>) {
    setLocales((prev) => ({ ...prev, [locale]: { ...prev[locale], ...patch } }));
  }

  function buildValues(): ContentBlockFormValues {
    return { label, type, color, locales };
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

  const displayTitle = title ?? (label.trim() || 'New content block');

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* ── Title + action buttons ──────────────────────────────────────── */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">{displayTitle}</h1>

        <div className="flex items-center gap-2">
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
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: locale tabs ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue="en">
            <TabsList variant="line" className="w-full justify-start">
              {SUPPORTED_LOCALES.map((locale) => {
                const hasHeading = locales[locale].heading.trim().length > 0;
                return (
                  <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                        hasHeading ? 'bg-green-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    <span>{LOCALE_LABELS[locale]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {SUPPORTED_LOCALES.map((locale) => (
              <TabsContent key={locale} value={locale}>
                <LocaleTabContent
                  locale={locale}
                  state={locales[locale]}
                  blockLabel={label}
                  blockColor={color}
                  onChange={(patch) => handleLocaleChange(locale, patch)}
                  disabled={isSubmitting}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ── Right: sidebar ──────────────────────────────────────────── */}
        <div className="w-[280px] shrink-0 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">

            {/* Content block name (label) */}
            <div className="space-y-1.5">
              <Label htmlFor="block-label">
                Content block name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="block-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Stitches"
                disabled={isSubmitting}
                maxLength={255}
              />
            </div>

            {/* Block type */}
            <div className="space-y-1.5">
              <Label htmlFor="block-type">
                Block type <span className="text-red-500">*</span>
              </Label>
              <Select value={type} onValueChange={setType} disabled={isSubmitting}>
                <SelectTrigger id="block-type">
                  <SelectValue placeholder="Select type…" />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color <span className="text-red-500">*</span></Label>
              <ColorPicker value={color} onChange={setColor} disabled={isSubmitting} />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
