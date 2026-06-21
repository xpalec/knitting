'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Search, ChevronsUpDown, Loader2, X, Plus, Pencil, Save } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { entriesApi, type Entry } from '@/lib/api/entries';
import {
  entryRelationshipsApi,
  EntryRelationshipType,
  type EntryRelationship,
} from '@/lib/api/entry-relationships';
import { resolveTranslation } from '@/lib/resolve-translation';
import { useRelationships } from './use-relationships';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RELATIONSHIP_TYPE_LABELS: Record<EntryRelationshipType, string> = {
  [EntryRelationshipType.PREREQUISITE]: 'Prerequisite',
  [EntryRelationshipType.VARIANT_OF]: 'Variant of',
  [EntryRelationshipType.ALTERNATIVE_TO]: 'Alternative to',
  [EntryRelationshipType.COMMONLY_CONFUSED_WITH]: 'Commonly confused with',
  [EntryRelationshipType.USED_IN]: 'Used in',
  [EntryRelationshipType.PART_OF]: 'Part of',
  [EntryRelationshipType.COUNTERPART_OF]: 'Counterpart of',
  [EntryRelationshipType.RELATED_TO]: 'Related to',
};

/** Canonical display order — matches enum declaration order. */
export const RELATIONSHIP_TYPE_ORDER: EntryRelationshipType[] = [
  EntryRelationshipType.PREREQUISITE,
  EntryRelationshipType.VARIANT_OF,
  EntryRelationshipType.ALTERNATIVE_TO,
  EntryRelationshipType.COMMONLY_CONFUSED_WITH,
  EntryRelationshipType.USED_IN,
  EntryRelationshipType.PART_OF,
  EntryRelationshipType.COUNTERPART_OF,
  EntryRelationshipType.RELATED_TO,
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RelationshipsPanelProps {
  /** The ID of the entry currently being edited. Undefined when the entry is unsaved. */
  entryId: string | undefined;
  /** The active locale code, used for display name resolution. */
  activeLocale: string;
  /** When true, all mutating controls are disabled (e.g. while the parent form is saving). */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Display name helper
// ---------------------------------------------------------------------------

/**
 * Resolves a display name for a search result entry.
 * List responses include a pre-computed `term` field rather than full `translations`.
 */
function resolveEntryDisplayName(entry: Entry, activeLocale: string): string {
  // List responses include a pre-computed `term` (English or first available).
  // Detail responses include full translations — use resolveTranslation for those.
  const translations = entry.translations ?? [];
  if (translations.length > 0) {
    return resolveTranslation(translations, activeLocale, (t) => t.term, entry.id).label;
  }
  // Fall back to the pre-flattened `term` field present in list responses
  return (entry as Entry & { term?: string | null }).term ?? entry.id;
}

// ---------------------------------------------------------------------------
// EditRelationshipDialog
// ---------------------------------------------------------------------------

interface EditRelationshipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relationship: EntryRelationship;
  displayName: string;
  onSaved: () => void;
}

function EditRelationshipDialog({
  open,
  onOpenChange,
  relationship,
  displayName,
  onSaved,
}: EditRelationshipDialogProps) {
  const [type, setType] = useState<EntryRelationshipType>(relationship.type);
  const [note, setNote] = useState(relationship.note ?? '');

  // Reset form when dialog opens with a (potentially different) relationship
  useEffect(() => {
    if (open) {
      setType(relationship.type);
      setNote(relationship.note ?? '');
    }
  }, [open, relationship]);

  const { mutate: save, isPending } = useMutation({
    mutationFn: () =>
      entryRelationshipsApi.updateRelationship(relationship.id, {
        type,
        note: note.trim(),
      }),
    onSuccess: () => {
      toast.success('Relationship updated');
      onSaved();
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(`Failed to update relationship: ${err.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit relationship — {displayName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-rel-type">Relationship type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as EntryRelationshipType)}
              disabled={isPending}
            >
              <SelectTrigger id="edit-rel-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPE_ORDER.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RELATIONSHIP_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-rel-note">
              Note <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="edit-rel-note"
              placeholder="Add a note…"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => save()}
            disabled={isPending}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Save size={14} aria-hidden="true" />
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// RelationshipCard sub-component
// ---------------------------------------------------------------------------

interface RelationshipCardProps {
  relationship: EntryRelationship;
  displayName: string;
  /** True when a delete API call is in-flight for this specific card. */
  isDeleting: boolean;
  readOnly: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

function RelationshipCard({
  relationship,
  displayName,
  isDeleting,
  readOnly,
  onEdit,
  onRemove,
}: RelationshipCardProps) {
  return (
    <li
      data-testid={`relationship-card-${relationship.id}`}
      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-xs"
    >
      <span
        className="text-sm font-medium text-slate-800 flex-1 truncate"
        data-testid="relationship-card-display-name"
      >
        {displayName}
        {relationship.note && relationship.note.trim().length > 0 && (
          <span
            className="ml-2 text-xs text-slate-400 font-normal italic"
            data-testid="relationship-card-note"
          >
            {relationship.note}
          </span>
        )}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={onEdit}
        disabled={readOnly}
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400 disabled:opacity-40"
        aria-label={`Edit relationship with ${displayName}`}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={isDeleting || readOnly}
        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400 disabled:opacity-40"
        aria-label={`Remove relationship with ${displayName}`}
        data-testid="relationship-card-remove-button"
      >
        {isDeleting ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <X size={13} aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RelationshipsPanel({
  entryId,
  activeLocale,
  readOnly = false,
}: RelationshipsPanelProps) {
  // Drive list state — hook is safe to call with undefined; it no-ops internally.
  const { relationships, isLoading, isError, retry, notifyMutated } =
    useRelationships(entryId);

  // ── Search combobox state ─────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<Entry[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [targetEntry, setTargetEntry] = useState<Entry | null>(null);

  // ── Type selector state ───────────────────────────────────────────────────
  const [selectedType, setSelectedType] = useState<EntryRelationshipType | null>(null);
  // ── Note state ────────────────────────────────────────────────────────────
  const [note, setNote] = useState('');

  // ── Delete state ─────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<EntryRelationship | null>(null);
  // ── Edit state ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<{ relationship: EntryRelationship; displayName: string } | null>(null);

  // ── Delete relationship mutation ──────────────────────────────────────────
  const { mutate: deleteRelationship } = useMutation({
    mutationFn: (id: string) => entryRelationshipsApi.deleteRelationship(id),
    onSuccess: () => {
      setDeletingId(null);
      notifyMutated();
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove relationship: ${err.message}`);
      setDeletingId(null);
    },
  });

  // ── Create relationship mutation ──────────────────────────────────────────
  const { mutate: createRelationship, isPending: isCreating } = useMutation({
    mutationFn: entryRelationshipsApi.createRelationship,
    onSuccess: () => {
      setTargetEntry(null);
      setSelectedType(null);
      setNote('');
      notifyMutated();
    },
    onError: (err: Error) => {
      toast.error(`Failed to add relationship: ${err.message}`);
    },
  });

  // ── 300 ms debounce on search input (same pattern as AbbreviationsPanel) ─
  useEffect(() => {
    if (!entryId) return;

    if (searchInput.length < 1) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await entriesApi.listEntries({ q: searchInput, limit: 10 });
        const rawResults = res.data ?? [];

        // Req 2.10: Filter out the source entry
        const withoutSelf = rawResults.filter((e) => e.id !== entryId);

        // Req 2.11: When a type is selected, filter out entries already linked
        // under that exact type
        const filtered =
          selectedType !== null
            ? withoutSelf.filter(
                (e) =>
                  !(relationships as EntryRelationship[]).some(
                    (r) => r.targetEntryId === e.id && r.type === selectedType,
                  ),
              )
            : withoutSelf;

        // Cap results at 10 after filtering (Req 2.2)
        setSearchResults(filtered.slice(0, 10));
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, entryId, selectedType, relationships]);

  // ── Unsaved entry state ───────────────────────────────────────────────────
  if (!entryId) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-4 text-sm text-slate-400">
        Relationships can be added after the entry is first saved.
      </div>
    );
  }

  // ── Saved entry state ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Add controls section — row 1: [entry search] [type selector]
                                  row 2: [note input] [Add] */}
      <div data-testid="add-controls-section">
        <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Relationships
        </Label>
        {/* Row 1: search combobox + type selector */}
        <div className="mt-2 flex gap-2">
          <EntrySearchCombobox
            open={searchOpen}
            onOpenChange={setSearchOpen}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            results={searchResults}
            isSearching={isSearching}
            targetEntry={targetEntry}
            onSelect={(entry) => {
              setTargetEntry(entry);
              setSearchOpen(false);
              setSearchInput('');
              setSearchResults([]);
            }}
            activeLocale={activeLocale}
            disabled={readOnly}
          />
          <Select
            value={selectedType ?? ''}
            onValueChange={(v) => setSelectedType(v as EntryRelationshipType)}
            disabled={readOnly}
          >
            <SelectTrigger
              className="w-[160px] shrink-0"
              data-testid="relationship-type-select"
            >
              <SelectValue placeholder="Type…" />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_TYPE_ORDER.map((type) => (
                <SelectItem key={type} value={type}>
                  {RELATIONSHIP_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: note input + Add button */}
        <div className="mt-2 flex gap-2">
          <Input
            data-testid="relationship-note-input"
            placeholder="Note (optional)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={readOnly}
            className="text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            disabled={targetEntry === null || selectedType === null || isCreating || readOnly}
            onClick={() => {
              if (!entryId || !targetEntry || !selectedType) return;
              const trimmedNote = note.trim();
              createRelationship({
                sourceEntryId: entryId,
                targetEntryId: targetEntry.id,
                type: selectedType,
                ...(trimmedNote.length > 0 ? { note: trimmedNote } : {}),
              });
            }}
          >
            {isCreating ? (
              <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            ) : (
              <Plus size={13} aria-hidden="true" />
            )}
            Add
          </Button>
        </div>
      </div>

      {/* Relationships list */}
      <div data-testid="relationships-list-section">
        {isLoading ? (
          <div className="space-y-2" data-testid="relationships-skeleton">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-4/5 rounded-md" />
          </div>
        ) : isError ? (
          <div className="space-y-2 rounded-md border border-red-100 bg-red-50 p-4" data-testid="relationships-error-state">
            <p className="text-sm text-red-600">Failed to load relationships.</p>
            <Button type="button" variant="outline" size="sm" onClick={retry} data-testid="relationships-retry-button">
              Retry
            </Button>
          </div>
        ) : relationships.length === 0 ? (
          <p className="text-sm text-slate-400" data-testid="relationships-empty-state">
            No relationships added yet.
          </p>
        ) : (
          <div className="space-y-4">
            {RELATIONSHIP_TYPE_ORDER.filter((type) =>
              relationships.some((r) => r.type === type),
            ).map((type) => (
              <div key={type} data-testid={`relationship-group-${type}`}>
                <h4
                  className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400"
                  data-testid="relationship-group-header"
                >
                  {RELATIONSHIP_TYPE_LABELS[type]}
                </h4>
                <ul className="space-y-2">
                  {relationships
                    .filter((r) => r.type === type)
                    .map((relationship) => {
                      const translations = relationship.targetEntry?.translations ?? [];
                      const displayName = resolveTranslation(
                        translations,
                        activeLocale,
                        (t) => t.term,
                        relationship.targetEntryId,
                      ).label;
                      return (
                        <RelationshipCard
                          key={relationship.id}
                          relationship={relationship}
                          displayName={displayName}
                          isDeleting={deletingId === relationship.id}
                          readOnly={readOnly}
                          onEdit={() => setEditTarget({ relationship, displayName })}
                          onRemove={() => setConfirmDeleteTarget(relationship)}
                        />
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit relationship dialog */}
      {editTarget && (
        <EditRelationshipDialog
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          relationship={editTarget.relationship}
          displayName={editTarget.displayName}
          onSaved={notifyMutated}
        />
      )}

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={confirmDeleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteTarget(null);
        }}
        title="Remove relationship"
        description={
          confirmDeleteTarget
            ? `Are you sure you want to remove this ${RELATIONSHIP_TYPE_LABELS[confirmDeleteTarget.type].toLowerCase()} relationship?`
            : ''
        }
        confirmLabel="Remove"
        loadingLabel="Removing…"
        loading={deletingId !== null}
        onConfirm={() => {
          if (!confirmDeleteTarget) return;
          setDeletingId(confirmDeleteTarget.id);
          setConfirmDeleteTarget(null);
          deleteRelationship(confirmDeleteTarget.id);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntrySearchCombobox sub-component
// ---------------------------------------------------------------------------

interface EntrySearchComboboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  results: Entry[];
  isSearching: boolean;
  targetEntry: Entry | null;
  onSelect: (entry: Entry) => void;
  activeLocale: string;
  disabled?: boolean;
}

function EntrySearchCombobox({
  open,
  onOpenChange,
  searchInput,
  onSearchInputChange,
  results,
  isSearching,
  targetEntry,
  onSelect,
  activeLocale,
  disabled,
}: EntrySearchComboboxProps) {
  const triggerLabel = targetEntry
    ? resolveEntryDisplayName(targetEntry, activeLocale)
    : 'Add relationship…';

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Search for a target entry"
          disabled={disabled}
          className={cn(
            'flex flex-1 min-w-0 items-center justify-between rounded-md border border-slate-200 bg-white',
            'px-3 py-2 text-sm text-left shadow-xs transition-colors',
            'hover:border-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            targetEntry ? 'text-slate-800' : 'text-slate-400',
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Search size={13} aria-hidden="true" />
            <span className="truncate">{triggerLabel}</span>
          </span>
          <ChevronsUpDown size={13} className="shrink-0 text-slate-400 ml-2" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)]"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search entries…"
            value={searchInput}
            onValueChange={onSearchInputChange}
          />
          <CommandList>
            {isSearching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : searchInput.length === 0 ? (
              <CommandEmpty>Type to search entries.</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No entries found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((entry) => {
                  const displayName = resolveEntryDisplayName(entry, activeLocale);
                  return (
                    <CommandItem
                      key={entry.id}
                      value={entry.id}
                      onSelect={() => onSelect(entry)}
                      className="gap-2"
                    >
                      <span className="text-sm flex-1 truncate">{displayName}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
