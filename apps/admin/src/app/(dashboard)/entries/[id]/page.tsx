'use client';

import { useState, useRef, use } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Upload, Trash2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { entriesApi } from '@/lib/api/entries';
import type { Entry, EntryStatus, SkillLevel, ContentBlock, Translation, UpdateTranslationPayload } from '@/lib/api/entries';
import { mediaApi } from '@/lib/api/media';
import type { MediaAsset } from '@/lib/api/media';
import { apiDelete } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS = ['en', 'pl', 'no', 'de', 'fr'];
const SKILL_LEVEL_OPTIONS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];
const BLOCK_TYPE_OPTIONS = ['definition', 'technique', 'media', 'callout', 'related', 'pattern_usage'];

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: EntryStatus }) {
  const styles: Record<EntryStatus, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    review: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    published: 'bg-green-50 text-green-700 border-green-200',
    deprecated: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize', styles[status])}>
      {status}
    </span>
  );
}

function getEnTerm(entry: Entry): string {
  const translations = entry.translations ?? [];
  return translations.find((t) => t.locale === 'en')?.term ?? translations[0]?.term ?? '—';
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

function PageHeader({ entry }: { entry: Entry }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
        <Link href="/entries">
          <ArrowLeft size={16} aria-hidden="true" />
          Back
        </Link>
      </Button>
      <div className="flex flex-1 flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">{getEnTerm(entry)}</h1>
        <StatusBadge status={entry.status} />
      </div>
      <Button variant="outline" size="sm" asChild className="gap-1.5">
        <a href="#" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden="true" />
          View on site
        </a>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoreTab
// ---------------------------------------------------------------------------

function CoreTab({ entry, entryId }: { entry: Entry; entryId: string }) {
  const queryClient = useQueryClient();
  const [originLanguage, setOriginLanguage] = useState(entry.origin_language);
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>(entry.metadata.skill_level ?? '');
  const [shortDef, setShortDef] = useState(entry.metadata.definition_short ?? '');
  const [deprecateOpen, setDeprecateOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      entriesApi.updateEntry(entryId, {
        origin_language: originLanguage,
        metadata: { ...entry.metadata, skill_level: skillLevel || undefined, definition_short: shortDef },
      }),
    onSuccess: () => {
      toast.success('Entry saved');
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
    },
    onError: () => toast.error('Failed to save entry'),
  });

  const statusMutation = useMutation({
    mutationFn: (status: EntryStatus) => entriesApi.updateEntryStatus(entryId, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const promoteLabel = entry.status === 'draft' ? 'Submit for Review' : entry.status === 'review' ? 'Publish' : null;
  const promoteTarget: EntryStatus | null = entry.status === 'draft' ? 'review' : entry.status === 'review' ? 'published' : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-1.5">
            <Label>Origin Language</Label>
            <Select value={originLanguage} onValueChange={setOriginLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((l) => (
                  <SelectItem key={l} value={l}>{l.toUpperCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Skill Level</Label>
            <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as SkillLevel)}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {SKILL_LEVEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Short Definition</Label>
            <Textarea rows={3} value={shortDef} onChange={(e) => setShortDef(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Current:</span>
            <StatusBadge status={entry.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {promoteLabel && promoteTarget && (
              <Button
                size="sm"
                onClick={() => statusMutation.mutate(promoteTarget)}
                disabled={statusMutation.isPending}
              >
                {promoteLabel}
              </Button>
            )}
            {entry.status !== 'deprecated' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeprecateOpen(true)}
                disabled={statusMutation.isPending}
              >
                Deprecate
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deprecateOpen}
        onOpenChange={setDeprecateOpen}
        title="Deprecate Entry"
        description="Are you sure you want to deprecate this entry? It will no longer be shown publicly."
        confirmLabel="Deprecate"
        onConfirm={() => { statusMutation.mutate('deprecated'); setDeprecateOpen(false); }}
        loading={statusMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TranslationBlockEditor
// ---------------------------------------------------------------------------

function TranslationBlockEditor({
  block,
  onChange,
}: {
  block: ContentBlock;
  onChange: (updated: ContentBlock) => void;
}) {
  if (block.type === 'definition') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-500 uppercase tracking-wide">Definition block</Label>
        <Textarea
          rows={3}
          value={(block.content as string) ?? ''}
          onChange={(e) => onChange({ ...block, content: e.target.value })}
        />
      </div>
    );
  }
  if (block.type === 'technique') {
    return <p className="text-xs text-slate-500 italic">Technique blocks — edit in Blocks tab</p>;
  }
  if (block.type === 'media') {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-slate-500 uppercase tracking-wide">Media block</Label>
        <p className="text-xs text-slate-400">URL: {(block.url as string) ?? '—'}</p>
        <Input
          placeholder="Alt text"
          value={(block.alt_text as string) ?? ''}
          onChange={(e) => onChange({ ...block, alt_text: e.target.value })}
        />
        <Input
          placeholder="Caption"
          value={(block.caption as string) ?? ''}
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </div>
    );
  }
  if (block.type === 'callout') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-500 uppercase tracking-wide">Callout block</Label>
        <Input
          value={(block.text as string) ?? ''}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
        />
      </div>
    );
  }
  if (block.type === 'related' || block.type === 'pattern_usage') {
    return <p className="text-xs text-slate-500 italic">Managed in Related tab</p>;
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-500 uppercase tracking-wide">{block.type} block (read-only)</Label>
      <pre className="rounded bg-slate-50 p-2 text-xs text-slate-600 overflow-auto max-h-32">
        {JSON.stringify(block, null, 2)}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LocaleForm — single locale inside TranslationsTab
// ---------------------------------------------------------------------------

function LocaleForm({
  translation,
  entryId,
}: {
  translation: Translation;
  entryId: string;
}) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState(translation.term);
  const [slug, setSlug] = useState(translation.slug);
  const [abbreviation, setAbbreviation] = useState(translation.abbreviation ?? '');
  const [shortDef, setShortDef] = useState(translation.definition_short ?? '');
  const [blocks, setBlocks] = useState<ContentBlock[]>(translation.content_blocks ?? []);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: UpdateTranslationPayload = { term, slug, definition_short: shortDef, content_blocks: blocks };
      if (abbreviation) payload.abbreviation = abbreviation;
      return entriesApi.updateTranslation(entryId, translation.locale, payload);
    },
    onSuccess: () => {
      toast.success(`Translation (${translation.locale}) saved`);
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
    },
    onError: () => toast.error('Failed to save translation'),
  });

  const translationStatusStyles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    reviewed: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    published: 'bg-green-50 text-green-700 border-green-200',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">Translation status:</span>
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize', translationStatusStyles[translation.status] ?? 'bg-slate-100 text-slate-600')}>
          {translation.status}
        </span>
      </div>
      <div className="space-y-1.5">
        <Label>Term</Label>
        <Input value={term} onChange={(e) => setTerm(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Slug</Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
        <p className="text-xs text-amber-600">Changing the slug may break existing links</p>
      </div>
      <div className="space-y-1.5">
        <Label>Abbreviation <span className="text-slate-400">(optional)</span></Label>
        <Input value={abbreviation} onChange={(e) => setAbbreviation(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Short Definition</Label>
        <Textarea rows={3} value={shortDef} onChange={(e) => setShortDef(e.target.value)} />
      </div>
      {blocks.length > 0 && (
        <div className="space-y-4">
          <Separator />
          <p className="text-sm font-medium text-slate-700">Content Blocks</p>
          {blocks.map((block, i) => (
            <TranslationBlockEditor
              key={i}
              block={block}
              onChange={(updated) => setBlocks((prev) => prev.map((b, idx) => idx === i ? updated : b))}
            />
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TranslationsTab
// ---------------------------------------------------------------------------

function TranslationsTab({ entry, entryId }: { entry: Entry; entryId: string }) {
  const locales = (entry.translations ?? []).map((t) => t.locale);
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  if (locales.length === 0) {
    return <p className="text-sm text-slate-500">No translations found.</p>;
  }

  return (
    <Tabs value={activeLocale} onValueChange={setActiveLocale}>
      <TabsList className="mb-4">
        {locales.map((locale) => (
          <TabsTrigger key={locale} value={locale}>{locale.toUpperCase()}</TabsTrigger>
        ))}
      </TabsList>
      {(entry.translations ?? []).map((t) => (
        <TabsContent key={t.locale} value={t.locale}>
          <Card>
            <CardContent className="pt-6">
              <LocaleForm translation={t} entryId={entryId} />
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ---------------------------------------------------------------------------
// RelatedTab (stub)
// ---------------------------------------------------------------------------

function RelatedTab({ entry }: { entry: Entry }) {
  const related = (entry.metadata.related_entries as unknown[]) ?? [];
  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-slate-600">Related entries management coming soon.</p>
        </CardContent>
      </Card>
      {related.length === 0 ? (
        <p className="text-sm text-slate-400">No related entries yet.</p>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <pre className="text-xs text-slate-600 overflow-auto">{JSON.stringify(related, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MediaTab
// ---------------------------------------------------------------------------

function MediaTab({ entryId }: { entryId: string }) {
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['entry-media', entryId],
    queryFn: () => mediaApi.listMedia({ entry_id: entryId }),
  });

  const assets: MediaAsset[] = data?.data ?? [];

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entry_id', entryId);
      return mediaApi.uploadMedia(fd);
    },
    onSuccess: () => {
      toast.success('Media uploaded');
      queryClient.invalidateQueries({ queryKey: ['entry-media', entryId] });
      setUploadOpen(false);
    },
    onError: () => toast.error('Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/admin/media/${id}`),
    onSuccess: () => {
      toast.success('Media deleted');
      queryClient.invalidateQueries({ queryKey: ['entry-media', entryId] });
      setDeleteTarget(null);
    },
    onError: () => toast.error('Failed to delete media'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload size={14} aria-hidden="true" />
          Upload
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ImageOff size={36} className="mb-3" aria-hidden="true" />
          <p className="text-sm">No media assets yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="overflow-hidden">
              <div className="relative h-36 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.cdn_url ?? asset.url}
                  alt={asset.alt_text ?? ''}
                  className="h-full w-full object-cover"
                />
              </div>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs capitalize">{asset.type}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => setDeleteTarget(asset)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </div>
                <p className="text-xs text-slate-400 truncate">{asset.url}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Upload Media</DialogTitle></DialogHeader>
          <div className="py-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploadMutation.isPending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Media"
        description="Are you sure you want to delete this media asset? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlocksTab (admin only)
// ---------------------------------------------------------------------------

function BlocksTab({ entry, entryId }: { entry: Entry; entryId: string }) {
  const queryClient = useQueryClient();
  const [blocks, setBlocks] = useState<ContentBlock[]>(entry.content_blocks ?? []);
  const [newBlockType, setNewBlockType] = useState<string>(BLOCK_TYPE_OPTIONS[0] ?? 'definition');

  const saveMutation = useMutation({
    mutationFn: () => entriesApi.updateBlocks(entryId, blocks),
    onSuccess: () => {
      toast.success('Blocks saved');
      queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
    },
    onError: () => toast.error('Failed to save blocks'),
  });

  function addBlock() {
    const nextOrder = blocks.length > 0 ? Math.max(...blocks.map((b) => b.order)) + 1 : 1;
    setBlocks((prev) => [...prev, { type: newBlockType, order: nextOrder, visible: true }]);
  }

  function toggleVisible(index: number) {
    setBlocks((prev) => prev.map((b, i) => i === index ? { ...b, visible: !b.visible } : b));
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="pt-6 space-y-3">
          {blocks.length === 0 ? (
            <p className="text-sm text-slate-400">No blocks yet.</p>
          ) : (
            <div className="divide-y">
              {blocks.map((block, i) => (
                <div key={i} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-6 text-right">{block.order}</span>
                    <Badge variant="outline" className="text-xs capitalize">{block.type}</Badge>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={block.visible}
                      onChange={() => toggleVisible(i)}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-700"
                    />
                    Visible
                  </label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Block</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Select value={newBlockType} onValueChange={setNewBlockType}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BLOCK_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addBlock}>Add</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save Blocks'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EntryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAdmin = currentUser?.role === 'admin';

  const { data: entry, isLoading, isError, refetch } = useQuery({
    queryKey: ['entry', id],
    queryFn: () => entriesApi.getEntry(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !entry) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-slate-600">Failed to load entry.</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader entry={entry} />
      <Separator />
      <Tabs defaultValue="core">
        <TabsList variant="line">
          <TabsTrigger variant="line" value="core">Core</TabsTrigger>
          <TabsTrigger variant="line" value="translations">Translations</TabsTrigger>
          <TabsTrigger variant="line" value="related">Related</TabsTrigger>
          <TabsTrigger variant="line" value="media">Media</TabsTrigger>
          {isAdmin && <TabsTrigger variant="line" value="blocks">Blocks</TabsTrigger>}
        </TabsList>

        <TabsContent value="core">
          <CoreTab entry={entry} entryId={id} />
        </TabsContent>

        <TabsContent value="translations">
          <TranslationsTab entry={entry} entryId={id} />
        </TabsContent>

        <TabsContent value="related">
          <RelatedTab entry={entry} />
        </TabsContent>

        <TabsContent value="media">
          <MediaTab entryId={id} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="blocks">
            <BlocksTab entry={entry} entryId={id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
