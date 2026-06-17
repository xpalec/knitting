'use client';

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

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
import type { Abbreviation } from '@/lib/api/abbreviations';

// ---------------------------------------------------------------------------
// Tiptap JSON helper
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
// Local tab state
// ---------------------------------------------------------------------------

interface LocaleTabState {
  short_meaning: string;
  description: unknown | null;
}

function makeEmptyTabs(locales: string[]): Record<string, LocaleTabState> {
  const result: Record<string, LocaleTabState> = {};
  for (const locale of locales) {
    result[locale] = { short_meaning: '', description: null };
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

export interface AbbreviationCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful creation (before optional post-create action). */
  onCreated?: (abbreviation: Abbreviation) => void;
  /**
   * Optional: if provided, after creating the abbreviation the dialog will
   * call this to link it to an entry. Receives the new Abbreviation.
   * Expected to throw on failure (the dialog shows an error toast in that case).
   */
  onLinkAfterCreate?: (abbreviation: Abbreviation) => Promise<void>;
  /** Query key to invalidate on success (e.g. ['abbreviations']). */
  queryKey?: unknown[];
  /**
   * Pre-selects the source language and opens on the matching tab.
   * When provided the source language field is hidden (set implicitly).
   */
  defaultSourceLanguage?: string;
  /** Pre-fills the code field (e.g. when opening from a failed search). */
  defaultCode?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AbbreviationCreateDialog({
  open,
  onOpenChange,
  onCreated,
  onLinkAfterCreate,
  queryKey,
  defaultSourceLanguage,
  defaultCode,
}: AbbreviationCreateDialogProps) {
  const queryClient = useQueryClient();
  const { allLocales, localeLabels, defaultLanguage } = useLanguages();
  const activeLocales = allLocales.length > 0 ? allLocales : ['en'];
  const defaultLocale = defaultSourceLanguage ?? defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  const [code, setCode] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState(defaultLocale);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [tabStates, setTabStates] = useState<Record<string, LocaleTabState>>(
    () => makeEmptyTabs(activeLocales),
  );
  const [activeLocale, setActiveLocale] = useState(defaultLocale);
  const [isSaving, setIsSaving] = useState(false);

  // Ensure newly added locales get state
  const enrichedTabStates = { ...tabStates };
  for (const locale of activeLocales) {
    if (!enrichedTabStates[locale]) {
      enrichedTabStates[locale] = { short_meaning: '', description: null };
    }
  }

  // Reset state whenever the dialog opens (covers both prop-driven and interaction-driven opens)
  useEffect(() => {
    if (open) {
      const initialLocale = defaultSourceLanguage ?? defaultLocale;
      setCode(defaultCode ?? '');
      setSourceLanguage(initialLocale);
      setCodeError(null);
      setTabStates(makeEmptyTabs(activeLocales));
      setActiveLocale(initialLocale);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!isSaving) onOpenChange(v);
    },
    [isSaving, onOpenChange],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (payload: { code: string; source_language: string }) =>
      abbreviationsApi.createAbbreviation(payload),
  });

  const upsertTranslationMutation = useMutation({
    mutationFn: ({
      id,
      locale,
      short_meaning,
      description,
    }: {
      id: string;
      locale: string;
      short_meaning: string | null;
      description: unknown | null;
    }) =>
      abbreviationsApi.upsertTranslation(id, locale, { short_meaning, description }, false),
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setCodeError(null);
    setIsSaving(true);

    // 1. Create abbreviation
    let created: Abbreviation;
    try {
      created = await createMutation.mutateAsync({
        code: code.trim(),
        source_language: sourceLanguage,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setCodeError(
          `The code "${code.trim()}" already exists for language "${sourceLanguage}".`,
        );
        setIsSaving(false);
        return;
      }
      const message =
        err instanceof ApiError ? err.message : 'Failed to create abbreviation';
      onOpenChange(false);
      toast.error(message);
      setIsSaving(false);
      return;
    }

    // 2. Create translations for any filled locale tabs
    const filledLocales = activeLocales.filter((locale) =>
      tabHasContent(enrichedTabStates[locale] ?? { short_meaning: '', description: null }),
    );

    for (const locale of filledLocales) {
      const state = enrichedTabStates[locale]!;
      try {
        await upsertTranslationMutation.mutateAsync({
          id: created.id,
          locale,
          short_meaning: state.short_meaning || null,
          description: state.description,
        });
      } catch {
        // Non-critical — the abbreviation was created; translation failed silently
      }
    }

    // 3. Optional post-create link
    if (onLinkAfterCreate) {
      try {
        await onLinkAfterCreate(created);
      } catch (err) {
        // Creation succeeded, linking failed — show error toast (Req 6.4)
        const message =
          err instanceof ApiError ? err.message : 'Abbreviation created but linking failed';
        toast.error(message);
        if (queryKey) {
          await queryClient.invalidateQueries({ queryKey });
        }
        onCreated?.(created);
        onOpenChange(false);
        setIsSaving(false);
        return;
      }
    }

    if (queryKey) {
      await queryClient.invalidateQueries({ queryKey });
    }
    onCreated?.(created);
    onOpenChange(false);
    toast.success('Abbreviation created');
    setIsSaving(false);
  }, [
    code,
    sourceLanguage,
    activeLocales,
    enrichedTabStates,
    createMutation,
    upsertTranslationMutation,
    onLinkAfterCreate,
    queryClient,
    queryKey,
    onCreated,
    onOpenChange,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) handleOpenChange(v); }}>
      <DialogContent
        className="max-w-3xl w-full p-0 overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            New Abbreviation
          </DialogTitle>
        </DialogHeader>

        {/* Inline conflict error */}
        {codeError && (
          <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {codeError}
          </div>
        )}

        <div className="flex flex-1 min-h-0 overflow-hidden mt-4">

          {/* ── Left: locale tabs ─────────────────────────────────────── */}
          <div className="flex-1 min-w-0 overflow-y-auto px-6 pb-6">

            {/* Code field + optional source language — above tabs */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 mb-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-abbrev-code">
                  Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="new-abbrev-code"
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

              {/* Source language: hidden input when pre-set, select when open choice */}
              {defaultSourceLanguage ? (
                <input type="hidden" name="source_language" value={sourceLanguage} />
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="new-abbrev-source-lang">
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
                    <SelectTrigger id="new-abbrev-source-lang">
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
              )}
            </div>

            <Tabs value={activeLocale} onValueChange={setActiveLocale}>
              <TabsList variant="line" className="w-full justify-start">
                {activeLocales.map((locale) => {
                  const state = enrichedTabStates[locale];
                  const hasContent = state ? tabHasContent(state) : false;
                  return (
                    <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                          hasContent ? 'bg-green-500' : 'bg-transparent',
                        )}
                        aria-hidden="true"
                      />
                      <span>{localeLabels[locale] ?? locale}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {activeLocales.map((locale) => {
                const state = enrichedTabStates[locale] ?? { short_meaning: '', description: null };
                return (
                  <TabsContent key={locale} value={locale} className="space-y-4 mt-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`short-meaning-${locale}`}>
                          Short meaning
                          <span className="ml-1 text-xs text-slate-400">(plain text, ≤500 chars)</span>
                        </Label>
                        <Input
                          id={`short-meaning-${locale}`}
                          placeholder="e.g. knit 2 together"
                          value={state.short_meaning}
                          onChange={(e) => {
                            const val = e.target.value.slice(0, 500);
                            setTabStates((prev) => ({
                              ...prev,
                              [locale]: { ...(prev[locale] ?? state), short_meaning: val },
                            }));
                          }}
                          disabled={isSaving}
                          maxLength={500}
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <Label>Description</Label>
                      <RichTextEditor
                        value={state.description}
                        onChange={(json) => {
                          setTabStates((prev) => ({
                            ...prev,
                            [locale]: { ...(prev[locale] ?? state), description: json },
                          }));
                        }}
                        placeholder="Write a detailed description…"
                        disabled={isSaving}
                      />
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0">
          <Button
            variant="outline"
            type="button"
            onClick={() => handleOpenChange(false)}
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
            {isSaving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
