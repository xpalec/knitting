'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useLanguages } from '@/hooks/useLanguages';
import { adminTagsApi } from '@/lib/api/tags';
import type { AdminTag } from '@/lib/api/tags';
import { toSlug } from '@/components/entries/entry-form';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TagCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after successful creation with the new tag. */
  onCreated?: (tag: AdminTag) => void;
  /** Query key to invalidate on success. */
  queryKey?: unknown[];
}

// ---------------------------------------------------------------------------
// Per-locale state
// ---------------------------------------------------------------------------

interface LocaleTabState {
  name: string;
  slug: string;
  slugManuallyEdited: boolean;
}

function makeEmptyTabs(locales: string[]): Record<string, LocaleTabState> {
  const result: Record<string, LocaleTabState> = {};
  for (const locale of locales) {
    result[locale] = { name: '', slug: '', slugManuallyEdited: false };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagCreateDialog({
  open,
  onOpenChange,
  onCreated,
  queryKey,
}: TagCreateDialogProps) {
  const queryClient = useQueryClient();
  const { allLocales, defaultLanguage, getLocaleLabel } = useLanguages();
  const activeLocales = allLocales.length > 0 ? allLocales : ['en'];
  const defaultLocale = defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  const [activeLocale, setActiveLocale] = useState(defaultLocale);
  const [tabStates, setTabStates] = useState<Record<string, LocaleTabState>>(
    () => makeEmptyTabs(activeLocales),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Ensure newly added locales get state
  const enrichedTabStates = { ...tabStates };
  for (const locale of activeLocales) {
    if (!enrichedTabStates[locale]) {
      enrichedTabStates[locale] = { name: '', slug: '', slugManuallyEdited: false };
    }
  }

  const enState = enrichedTabStates['en'] ?? enrichedTabStates[defaultLocale];
  const canSave = (enState?.name.trim().length ?? 0) > 0;

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) {
        setTabStates(makeEmptyTabs(activeLocales));
        setActiveLocale(defaultLocale);
        setNameError(null);
      }
      onOpenChange(v);
    },
    [activeLocales, defaultLocale, onOpenChange],
  );

  function patchLocale(locale: string, patch: Partial<LocaleTabState>) {
    setTabStates((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] ?? { name: '', slug: '', slugManuallyEdited: false }), ...patch },
    }));
  }

  function handleNameChange(locale: string, value: string) {
    const state = enrichedTabStates[locale] ?? { name: '', slug: '', slugManuallyEdited: false };
    const patch: Partial<LocaleTabState> = { name: value };
    if (!state.slugManuallyEdited) patch.slug = toSlug(value);
    patchLocale(locale, patch);
    if (locale === 'en' || locale === defaultLocale) setNameError(null);
  }

  const createMutation = useMutation({
    mutationFn: (payload: { name_en: string; slug_en?: string }) =>
      adminTagsApi.createTag(payload),
  });

  const upsertTranslationMutation = useMutation({
    mutationFn: ({ id, locale, name, slug }: { id: string; locale: string; name: string; slug: string }) =>
      adminTagsApi.upsertTranslation(id, locale, { name, slug }),
  });

  const handleSave = useCallback(async () => {
    setNameError(null);
    const enTab = enrichedTabStates['en'] ?? enrichedTabStates[defaultLocale];
    if (!enTab?.name.trim()) {
      setNameError('English name is required.');
      setActiveLocale('en');
      return;
    }

    setIsSaving(true);

    let created: AdminTag;
    try {
      created = await createMutation.mutateAsync({
        name_en: enTab.name.trim(),
        slug_en: enTab.slug.trim() || toSlug(enTab.name.trim()),
      });
    } catch {
      toast.error('Failed to create tag.');
      setIsSaving(false);
      return;
    }

    // Upsert translations for other filled locales (en was handled by createTag)
    const otherLocales = activeLocales.filter((l) => l !== 'en' && l !== defaultLocale);
    for (const locale of otherLocales) {
      const state = enrichedTabStates[locale];
      if (!state?.name.trim()) continue;
      try {
        await upsertTranslationMutation.mutateAsync({
          id: created.id,
          locale,
          name: state.name.trim(),
          slug: state.slug.trim() || toSlug(state.name.trim()),
        });
      } catch {
        // non-critical — tag created, translation failed silently
      }
    }

    if (queryKey) await queryClient.invalidateQueries({ queryKey });
    toast.success('Tag created');
    onCreated?.(created);
    handleOpenChange(false);
    setIsSaving(false);
  }, [enrichedTabStates, defaultLocale, activeLocales, createMutation, upsertTranslationMutation, queryClient, queryKey, onCreated, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) handleOpenChange(v); }}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-800">New Tag</DialogTitle>
        </DialogHeader>

        {nameError && (
          <div className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {nameError}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 mt-4">
          <Tabs value={activeLocale} onValueChange={setActiveLocale}>
            <TabsList variant="line" className="w-full justify-start">
              {activeLocales.map((locale) => {
                const hasName = (enrichedTabStates[locale]?.name.trim().length ?? 0) > 0;
                return (
                  <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                        hasName ? 'bg-green-500' : 'bg-transparent',
                      )}
                      aria-hidden="true"
                    />
                    {getLocaleLabel(locale)}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {activeLocales.map((locale) => {
              const state = enrichedTabStates[locale] ?? { name: '', slug: '', slugManuallyEdited: false };
              const isDefault = locale === 'en' || locale === defaultLocale;
              return (
                <TabsContent key={locale} value={locale} className="mt-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`tag-name-${locale}`}>
                          Name {isDefault && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id={`tag-name-${locale}`}
                          placeholder="Tag name"
                          value={state.name}
                          onChange={(e) => handleNameChange(locale, e.target.value)}
                          disabled={isSaving}
                          className={cn(isDefault && nameError && !state.name.trim() && 'border-red-400')}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`tag-slug-${locale}`}>Slug</Label>
                        <Input
                          id={`tag-slug-${locale}`}
                          placeholder="tag-name"
                          value={state.slug}
                          onChange={(e) => patchLocale(locale, { slug: e.target.value, slugManuallyEdited: true })}
                          disabled={isSaving}
                          className="font-mono text-sm text-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
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
            disabled={isSaving || !canSave}
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
