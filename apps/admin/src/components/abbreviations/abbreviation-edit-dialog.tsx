'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Save, X } from 'lucide-react';

import { cn } from '@/lib/utils';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useLanguages } from '@/hooks/useLanguages';
import { abbreviationsApi } from '@/lib/api/abbreviations';
import { ApiError } from '@/lib/api/client';
import type { Abbreviation, AbbreviationTranslation } from '@/lib/api/abbreviations';

// ---------------------------------------------------------------------------
// Tiptap JSON helper — check if a description has any non-whitespace text
// ---------------------------------------------------------------------------

interface TiptapNode {
  type?: string;
  text?: string;
  content?: TiptapNode[];
}

function hasNonWhitespaceText(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as TiptapNode;
  if (n.type === 'text' && typeof n.text === 'string' && n.text.trim().length > 0) {
    return true;
  }
  if (Array.isArray(n.content)) {
    return n.content.some(hasNonWhitespaceText);
  }
  return false;
}

function descriptionHasContent(description: unknown): boolean {
  if (!description) return false;
  return hasNonWhitespaceText(description);
}

// ---------------------------------------------------------------------------
// Tab state
// ---------------------------------------------------------------------------

interface LocaleTabState {
  short_meaning: string;
  description: unknown | null;
  /** dirty = differs from the value at dialog open time */
  dirty: boolean;
  /** The translation row already exists on the server */
  existsOnServer: boolean;
  /** Per-locale inline error from a failed upsert */
  error: string | null;
}

function buildInitialTabStates(
  allLocales: string[],
  translations: AbbreviationTranslation[],
): Record<string, LocaleTabState> {
  const result: Record<string, LocaleTabState> = {};
  for (const locale of allLocales) {
    const existing = translations.find((t) => t.locale === locale);
    result[locale] = {
      short_meaning: existing?.short_meaning ?? '',
      description: existing?.description ?? null,
      dirty: false,
      existsOnServer: Boolean(existing),
      error: null,
    };
  }
  return result;
}

function tabHasContent(state: LocaleTabState): boolean {
  if (state.short_meaning.trim().length > 0) return true;
  if (descriptionHasContent(state.description)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AbbreviationEditDialogProps {
  /** Controls open/close state. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The abbreviation to edit. */
  abbreviation: Abbreviation;
  /** Called after a successful save (dialog remains open until this resolves). */
  onSaved?: (updated: Abbreviation) => void;
  /** Query key to invalidate on success (e.g. ['abbreviations']). */
  queryKey?: unknown[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AbbreviationEditDialog({
  open,
  onOpenChange,
  abbreviation,
  onSaved,
  queryKey,
}: AbbreviationEditDialogProps) {
  const queryClient = useQueryClient();
  const { allLocales, localeLabels, defaultLanguage } = useLanguages();
  const activeLocales = allLocales.length > 0 ? allLocales : ['en'];
  const defaultLocale = defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  // ── Core metadata state ──────────────────────────────────────────────────
  const [code, setCode] = useState(abbreviation.code);
  const [sourceLanguage, setSourceLanguage] = useState(abbreviation.source_language);
  const [codeError, setCodeError] = useState<string | null>(null);

  // ── Locale tabs state ────────────────────────────────────────────────────
  const [tabStates, setTabStates] = useState<Record<string, LocaleTabState>>(
    () => buildInitialTabStates(activeLocales, abbreviation.translations),
  );

  // ── Active tab ───────────────────────────────────────────────────────────
  const [activeLocale, setActiveLocale] = useState(defaultLocale);

  // Re-initialise when abbreviation changes or dialog opens
  useEffect(() => {
    if (open) {
      setCode(abbreviation.code);
      setSourceLanguage(abbreviation.source_language);
      setCodeError(null);
      setTabStates(buildInitialTabStates(activeLocales, abbreviation.translations));
      setActiveLocale(defaultLocale);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, abbreviation]);

  // Ensure newly added locales get a default state
  const enrichedTabStates = { ...tabStates };
  for (const locale of activeLocales) {
    if (!enrichedTabStates[locale]) {
      enrichedTabStates[locale] = {
        short_meaning: '',
        description: null,
        dirty: false,
        existsOnServer: false,
        error: null,
      };
    }
  }

  // ── Multi-entry warning ──────────────────────────────────────────────────
  const linkedEntryCount = abbreviation.entry_abbreviations?.length ?? 0;
  const showMultiEntryWarning = linkedEntryCount > 1;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function updateTabState(locale: string, patch: Partial<LocaleTabState>) {
    setTabStates((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] ?? enrichedTabStates[locale]!), ...patch },
    }));
  }

  function handleShortMeaningChange(locale: string, value: string) {
    updateTabState(locale, { short_meaning: value, dirty: true, error: null });
  }

  function handleDescriptionChange(locale: string, value: unknown) {
    updateTabState(locale, { description: value, dirty: true, error: null });
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const updateMetaMutation = useMutation({
    mutationFn: (payload: { code: string; source_language: string }) =>
      abbreviationsApi.updateAbbreviation(abbreviation.id, payload),
  });

  const upsertTranslationMutation = useMutation({
    mutationFn: ({
      locale,
      short_meaning,
      description,
      exists,
    }: {
      locale: string;
      short_meaning: string | null;
      description: unknown | null;
      exists: boolean;
    }) =>
      abbreviationsApi.upsertTranslation(
        abbreviation.id,
        locale,
        { short_meaning: short_meaning || null, description },
        exists,
      ),
  });

  // ── Save handler ─────────────────────────────────────────────────────────

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setCodeError(null);
    setIsSaving(true);

    // Clear per-locale errors from previous attempt
    setTabStates((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = { ...next[k]!, error: null };
      }
      return next;
    });

    // 1. Update metadata only if changed
    const metaChanged =
      code.trim() !== abbreviation.code || sourceLanguage !== abbreviation.source_language;

    let updatedAbbreviation: Abbreviation = abbreviation;

    if (metaChanged) {
      try {
        updatedAbbreviation = await updateMetaMutation.mutateAsync({
          code: code.trim(),
          source_language: sourceLanguage,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setCodeError(
            `The code "${code.trim()}" already exists for language "${sourceLanguage}".`,
          );
          setIsSaving(false);
          return; // keep dialog open — 7.6
        }
        // Other error — close dialog, show toast (7.7)
        const message =
          err instanceof ApiError ? err.message : 'Failed to update abbreviation';
        onOpenChange(false);
        toast.error(message);
        setIsSaving(false);
        return;
      }
    }

    // 2. Upsert dirty locale tabs concurrently
    const dirtyLocales = activeLocales.filter(
      (locale) => enrichedTabStates[locale]?.dirty,
    );

    if (dirtyLocales.length === 0) {
      // Nothing more to do — success
      if (queryKey) {
        await queryClient.invalidateQueries({ queryKey });
      }
      onSaved?.(updatedAbbreviation);
      onOpenChange(false);
      toast.success('Abbreviation saved');
      setIsSaving(false);
      return;
    }

    const results = await Promise.allSettled(
      dirtyLocales.map((locale) => {
        const state = enrichedTabStates[locale]!;
        return upsertTranslationMutation
          .mutateAsync({
            locale,
            short_meaning: state.short_meaning || null,
            description: state.description,
            exists: state.existsOnServer,
          })
          .then(() => ({ locale, ok: true as const }))
          .catch((err: unknown) => ({ locale, ok: false as const, err }));
      }),
    );

    const failures = results
      .map((r) => (r.status === 'fulfilled' ? r.value : { locale: '?', ok: false as const, err: r.reason }))
      .filter((r): r is { locale: string; ok: false; err: unknown } => !r.ok);

    if (failures.length > 0) {
      // Partial failure — keep dialog open, show per-locale errors (7.8)
      setTabStates((prev) => {
        const next = { ...prev };
        for (const failure of failures) {
          const msg =
            failure.err instanceof ApiError
              ? failure.err.message
              : 'Failed to save translation';
          next[failure.locale] = { ...next[failure.locale]!, error: msg };
        }
        // Mark successful locales as no longer dirty
        for (const r of results) {
          const val = r.status === 'fulfilled' ? r.value : null;
          if (val?.ok) {
            next[val.locale] = { ...next[val.locale]!, dirty: false, error: null };
          }
        }
        return next;
      });
      setIsSaving(false);
      return;
    }

    // Full success
    // Mark all dirty locales as saved
    setTabStates((prev) => {
      const next = { ...prev };
      for (const locale of dirtyLocales) {
        next[locale] = { ...next[locale]!, dirty: false, existsOnServer: true };
      }
      return next;
    });

    if (queryKey) {
      await queryClient.invalidateQueries({ queryKey });
    }
    onSaved?.(updatedAbbreviation);
    onOpenChange(false);
    toast.success('Abbreviation saved');
    setIsSaving(false);
  }, [
    code,
    sourceLanguage,
    abbreviation,
    activeLocales,
    enrichedTabStates,
    updateMetaMutation,
    upsertTranslationMutation,
    queryClient,
    queryKey,
    onSaved,
    onOpenChange,
  ]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent
        className="max-w-5xl w-full p-0 overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Edit Abbreviation — {abbreviation.code}
          </DialogTitle>
        </DialogHeader>

        {/* Multi-entry warning */}
        {showMultiEntryWarning && (
          <div className="mx-6 mt-3 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" aria-hidden="true" />
            <span>
              This abbreviation is linked to <strong>{linkedEntryCount} entries</strong>.
              Changes will affect all linked entries.
            </span>
          </div>
        )}

        {/* Inline conflict error */}
        {codeError && (
          <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {codeError}
          </div>
        )}

        {/* Body — two-column layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden mt-4">

          {/* ── Left: locale tabs ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-y-auto px-6 pb-6">
            <Tabs value={activeLocale} onValueChange={setActiveLocale}>
              <TabsList variant="line" className="w-full justify-start">
                {activeLocales.map((locale) => {
                  const state = enrichedTabStates[locale];
                  const hasContent = state ? tabHasContent(state) : false;
                  const hasError = Boolean(state?.error);
                  return (
                    <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                          hasError
                            ? 'bg-red-500'
                            : hasContent
                            ? 'bg-green-500'
                            : 'bg-transparent',
                        )}
                        aria-hidden="true"
                      />
                      <span>{localeLabels[locale] ?? locale}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {activeLocales.map((locale) => {
                const state = enrichedTabStates[locale] ?? {
                  short_meaning: '',
                  description: null,
                  dirty: false,
                  existsOnServer: false,
                  error: null,
                };
                return (
                  <TabsContent key={locale} value={locale} className="space-y-4 mt-4">
                    {/* Per-locale error */}
                    {state.error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {state.error}
                      </div>
                    )}

                    {/* Short meaning */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`short-meaning-${locale}`}>
                          Short meaning
                          <span className="ml-1 text-xs text-slate-400">(plain text, ≤500 chars)</span>
                        </Label>
                        <Input
                          id={`short-meaning-${locale}`}
                          placeholder={`e.g. knit 2 together`}
                          value={state.short_meaning}
                          onChange={(e) =>
                            handleShortMeaningChange(locale, e.target.value.slice(0, 500))
                          }
                          disabled={isSaving}
                          maxLength={500}
                        />
                      </div>
                    </div>

                    {/* Description (RichText) */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <Label>Description</Label>
                      <RichTextEditor
                        value={state.description}
                        onChange={(json) => handleDescriptionChange(locale, json)}
                        placeholder="Write a detailed description…"
                        disabled={isSaving}
                      />
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>

          {/* ── Right: metadata sidebar ───────────────────────────────── */}
          <div className="w-72 shrink-0 border-l border-slate-100 overflow-y-auto px-5 pb-6 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
              <p className="text-sm font-semibold text-slate-700">Abbreviation</p>

              {/* Code */}
              <div className="space-y-1.5">
                <Label htmlFor="abbrev-code">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="abbrev-code"
                  placeholder="e.g. K2tog"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeError(null);
                  }}
                  disabled={isSaving}
                  maxLength={255}
                  className={cn(codeError && 'border-red-400')}
                />
                {codeError && (
                  <p className="text-xs text-red-500">{codeError}</p>
                )}
              </div>

              {/* Source language */}
              <div className="space-y-1.5">
                <Label htmlFor="abbrev-source-lang">
                  Source language <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={sourceLanguage}
                  onValueChange={(v) => {
                    setSourceLanguage(v);
                    setCodeError(null);
                  }}
                  disabled={isSaving}
                >
                  <SelectTrigger id="abbrev-source-lang">
                    <SelectValue placeholder="Select language…" />
                  </SelectTrigger>
                  <SelectContent>
                    {allLocales.map((locale) => (
                      <SelectItem key={locale} value={locale}>
                        {localeLabels[locale] ?? locale}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="gap-2"
          >
            <X size={15} aria-hidden="true" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !code.trim() || !sourceLanguage}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Save size={15} aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
