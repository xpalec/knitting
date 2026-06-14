'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { entriesApi, listEntryCategories } from '@/lib/api/entries';
import type { Entry, EntryStatus } from '@/lib/api/entries';
import { entryTemplatesApi } from '@/lib/api/entry-templates';
import { contentBlockTypesApi } from '@/lib/api/content-block-types';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntryForm } from '@/components/entries/entry-form';
import type { EntryFormValues, SupportedLocale, BlockEditorState } from '@/components/entries/entry-form';

// ---------------------------------------------------------------------------
// Helper — map API Entry → EntryFormValues
// ---------------------------------------------------------------------------

let _idSeq = 1000;
function nextId() { return `b-${_idSeq++}`; }

function mapEntryToFormValues(entry: Entry): EntryFormValues {
  const locales: EntryFormValues['locales'] = {};

  // Block structure comes from the linked template (ordered list of slots).
  // Per-locale content comes from Translation.blocks[order].
  const templateBlocks = entry.entry_template?.blocks ?? [];

  // Build locale data for all locales that have existing translations.
  // The form's dynamic locale list (from language settings) controls which tabs are shown;
  // this mapping just preserves any existing translation data.
  const translationLocales = (entry.translations ?? []).map((t) => t.locale);
  // Also ensure we populate any standard locales even if not yet translated
  const allLocales = Array.from(new Set([...translationLocales]));

  for (const locale of allLocales) {
    const t = entry.translations?.find((tr) => tr.locale === locale);
    const translationBlocks = t?.blocks ?? {};

    const blocks: BlockEditorState[] = templateBlocks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((slot) => {
        const saved = translationBlocks[slot.id];
        // Use saved heading if present, otherwise fall back to the template's default for this locale
        const templateTranslations = entry.entry_template?.translations ?? {};
        const defaultHeading = templateTranslations[slot.id]?.[locale]?.heading ?? '';
        return {
          _id: nextId(),
          blockId: slot.id,
          type: slot.type,
          label: slot.label ?? slot.type,
          heading: (saved as Record<string, string> | undefined)?.heading ?? defaultHeading,
          headingManuallyEdited: Boolean((saved as Record<string, string> | undefined)?.heading),
          content: saved?.content ?? null,
          visible: true,
          required: slot.required,
          order: slot.order,
        };
      });

    locales[locale as SupportedLocale] = {
      title: t?.term ?? '',
      slug: t?.slug ?? '',
      slugManuallyEdited: Boolean(t?.slug),
      shortDescription: (t?.metadata as Record<string, unknown> | undefined)?.definition_short as string ?? '',
      seoTitle: '',
      seoDescription: '',
      blocks,
    };
  }

  return {
    entryTemplateId: entry.entry_template_id ?? '',
    categoryId: entry.category_id ?? '',
    status: entry.status as EntryStatus,
    synonyms: [],
    tags: (entry.tags ?? []).map((tag) => tag.name),
    abbreviations: [],
    locales,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EntryEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Role guard — allow both admin and editor to edit
  useEffect(() => {
    if (currentUser && currentUser.role === 'reviewer') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  // Fetch the entry
  const { data: entry, isLoading: isLoadingEntry, isError, error } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.getEntry(id),
  });

  // Fetch categories
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['categories-entry'],
    queryFn: () => listEntryCategories(),
  });

  // Fetch entry templates
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['entry-templates'],
    queryFn: () => entryTemplatesApi.list(),
  });

  // Fetch content block types (for block editor labels + colors)
  const { data: contentBlockTypes, isLoading: isLoadingContentBlockTypes } = useQuery({
    queryKey: ['content-block-types'],
    queryFn: () => contentBlockTypesApi.list(),
  });

  // Handle 404
  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 404) {
      toast.error('Entry not found');
      router.replace('/entries');
    }
  }, [isError, error, router]);

  // ── Update mutation ──────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (values: EntryFormValues) => {
      // 1. Update entry_template_id and/or category_id if changed
      const entryTemplateChanged = values.entryTemplateId !== (entry?.entry_template_id ?? '');
      const categoryChanged = values.categoryId !== (entry?.category_id ?? '');

      if (entryTemplateChanged || categoryChanged) {
        await entriesApi.updateEntry(id, {
          ...(entryTemplateChanged && { entry_template_id: values.entryTemplateId || undefined }),
          ...(categoryChanged && { category_id: values.categoryId || '' }),
        });
      }

      // 2. Update entry status if changed
      if (values.status !== entry?.status) {
        await entriesApi.updateEntryStatus(id, values.status as EntryStatus);
      }

      // 3. Upsert translations for each locale that has a title
      const locales = Object.keys(values.locales) as string[];
      await Promise.all(
        locales
          .filter((locale) => values.locales[locale]?.title?.trim())
          .map((locale) => {
            const ls = values.locales[locale]!;
            // Serialize block content keyed by stable block UUID
            const blocks: Record<string, { content?: unknown }> = {};
            for (const b of ls.blocks) {
              blocks[b.blockId] = { content: b.content ?? undefined };
            }
            return entriesApi.updateTranslation(id, locale, {
              term: ls.title.trim(),
              slug: ls.slug.trim() || undefined,
              metadata: ls.shortDescription.trim()
                ? { definition_short: ls.shortDescription.trim() }
                : undefined,
              blocks: Object.keys(blocks).length > 0 ? blocks : undefined,
            });
          }),
      );
    },
    onSuccess: () => {
      toast.success('Entry saved');
      queryClient.invalidateQueries({ queryKey: ['entry', id] });
      queryClient.invalidateQueries({ queryKey: ['entries'] });
    },
    onError: () => toast.error('Failed to save entry'),
  });

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => entriesApi.deleteEntry(id),
    onSuccess: () => {
      toast.success('Entry deleted');
      queryClient.invalidateQueries({ queryKey: ['entries'] });
      router.push('/entries');
    },
    onError: () => {
      setDeleteDialogOpen(false);
      toast.error('Failed to delete entry');
    },
  });

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoadingEntry) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-72" />
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="flex gap-2 border-b pb-2">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-7 w-20" />)}
            </div>
            <div className="rounded-lg border border-slate-200 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-20 w-full" />
            </div>
            <Skeleton className="h-48 w-full rounded-lg" />
          </div>
          <div className="w-[480px] space-y-3">
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="flex gap-3 border-b pb-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 w-16" />)}
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !entry) return null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-6">
        <EntryForm
          defaultValues={mapEntryToFormValues(entry)}
          categories={categoriesData?.data}
          isLoadingCategories={isLoadingCategories}
          templates={templates}
          isLoadingTemplates={isLoadingTemplates}
          contentBlockTypes={contentBlockTypes}
          isLoadingContentBlockTypes={isLoadingContentBlockTypes}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
          onSaveDraft={(values) => updateMutation.mutate(values)}
          onCancel={() => router.push('/entries')}
          onDelete={() => setDeleteDialogOpen(true)}
          title={entry.translations?.find((t) => t.locale === 'en')?.term ?? entry.term ?? 'Edit entry'}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Entry"
        description={`Are you sure you want to delete this entry? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
