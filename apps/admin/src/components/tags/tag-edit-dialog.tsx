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

export interface TagEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: AdminTag;
  /** Called after successful save with the updated tag. */
  onSaved?: (tag: AdminTag) => void;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagEditDialog({
  open,
  onOpenChange,
  tag,
  onSaved,
  queryKey,
}: TagEditDialogProps) {
  const queryClient = useQueryClient();
  const { allLocales, defaultLanguage, getLocaleLabel } = useLanguages();
  const activeLocales = allLocales.length > 0 ? allLocales : ['en'];
  const defaultLocale = defaultLanguage?.locale ?? activeLocales[0] ?? 'en';

  const [activeLocale, setActiveLocale] = useState(defaultLocale);
  const [tabStates, setTabStates] = useState<Record<string, LocaleTabState>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Populate from tag translations whenever dialog opens or tag changes
  useEffect(() => {
    if (!open) return;
    const initial: Record<string, LocaleTabState> = {};
    for (const locale of activeLocales) {
      const tr = tag.translations.find((t) => t.locale === locale);
      initial[locale] = {
        name: tr?.name ?? '',
        slug: tr?.slug ?? '',
        slugManuallyEdited: Boolean(tr?.slug),
      };
    }
    setTabStates(initial);
    setActiveLocale(defaultLocale);
  }, [open, tag]); // eslint-disable-line react-hooks/exhaustive-deps

  const enrichedTabStates: Record<string, LocaleTabState> = {};
  for (const locale of activeLocales) {
    enrichedTabStates[locale] = tabStates[locale] ?? { name: '', slug: '', slugManuallyEdited: false };
  }

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
  }

  const upsertTranslationMutation = useMutation({
    mutationFn: ({ locale, name, slug }: { locale: string; name: string; slug: string }) =>
      adminTagsApi.upsertTranslation(tag.id, locale, { name, slug }),
  });

  const handleSave = useCallback(async () => {
    setIsSaving(true);

    const filledLocales = activeLocales.filter(
      (l) => (enrichedTabStates[l]?.name.trim().length ?? 0) > 0,
    );

    for (const locale of filledLocales) {
      const state = enrichedTabStates[locale]!;
      try {
        await upsertTranslationMutation.mutateAsync({
          locale,
          name: state.name.trim(),
          slug: state.slug.trim() || toSlug(state.name.trim()),
        });
      } catch {
        toast.error(`Failed to save ${getLocaleLabel(locale)} translation.`);
        setIsSaving(false);
        return;
      }
    }

    if (queryKey) await queryClient.invalidateQueries({ queryKey });
    toast.success('Tag saved');

    // Build an optimistic updated tag for the callback
    const updatedTag: AdminTag = {
      ...tag,
      translations: activeLocales
        .map((locale) => {
          const state = enrichedTabStates[locale];
          if (!state?.name.trim()) return null;
          const existing = tag.translations.find((t) => t.locale === locale);
          return {
            locale,
            name: state.name.trim(),
            slug: state.slug.trim() || toSlug(state.name.trim()),
            description: existing?.description ?? null,
            seo_title: existing?.seo_title ?? null,
            seo_description: existing?.seo_description ?? null,
            status: existing?.status ?? 'draft' as const,
          };
        })
        .filter(Boolean) as AdminTag['translations'],
    };

    onSaved?.(updatedTag);
    onOpenChange(false);
    setIsSaving(false);
  }, [enrichedTabStates, activeLocales, tag, upsertTranslationMutation, queryClient, queryKey, onSaved, onOpenChange, getLocaleLabel]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isSaving) onOpenChange(v); }}>
      <DialogContent className="max-w-2xl w-full p-0 overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-semibold text-slate-800">Edit Tag</DialogTitle>
        </DialogHeader>

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
              return (
                <TabsContent key={locale} value={locale} className="mt-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`edit-tag-name-${locale}`}>Name</Label>
                        <Input
                          id={`edit-tag-name-${locale}`}
                          placeholder="Tag name"
                          value={state.name}
                          onChange={(e) => handleNameChange(locale, e.target.value)}
                          disabled={isSaving}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`edit-tag-slug-${locale}`}>Slug</Label>
                        <Input
                          id={`edit-tag-slug-${locale}`}
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
            disabled={isSaving}
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
