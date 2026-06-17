'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, ChevronsUpDown, Plus, Pencil, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { MissingTranslationBadge } from '@/components/ui/missing-translation-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TagCreateDialog } from '@/components/tags/tag-create-dialog';
import { TagEditDialog } from '@/components/tags/tag-edit-dialog';

import { adminTagsApi, type AdminTag } from '@/lib/api/tags';
import { entriesApi } from '@/lib/api/entries';
import { resolveTranslation } from '@/lib/resolve-translation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TagsPanelProps {
  /** The ID of the saved entry. Undefined for a new (unsaved) entry. */
  entryId?: string;
  /** Full AdminTag objects for every currently linked tag (for name resolution). */
  linkedTags: AdminTag[];
  /** The active locale code, used to pick the right translation. */
  activeLocale: string;
  /** Called when the user links or unlinks a tag (updates parent form state — IDs only). */
  onTagsChange: (tagIds: string[]) => void;
  /** Called when the full tag objects list changes (for optimistic UI). */
  onTagObjectsChange?: (tags: AdminTag[]) => void;
  /** Called after a successful API link/unlink so the parent can refetch. */
  onLinkChanged?: () => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Label resolution helper
// ---------------------------------------------------------------------------

function resolveTagLabel(
  tag: AdminTag,
  activeLocale: string,
): { label: string; isFallback: boolean } {
  return resolveTranslation(
    tag.translations,
    activeLocale,
    (t) => t.name,
    tag.id,
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagsPanel({
  entryId,
  linkedTags,
  activeLocale,
  onTagsChange,
  onTagObjectsChange,
  onLinkChanged,
  disabled,
}: TagsPanelProps) {
  // ── Search popover state ──────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [searchResults, setSearchResults] = useState<AdminTag[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminTag | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminTag | null>(null);

  // ── 300 ms debounce on search input ──────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch search results when debounced query changes ────────────────────
  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length === 0) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await adminTagsApi.listTags({ search: q, limit: 20 });
      // Exclude already-linked tag IDs from results
      const linkedIds = new Set(linkedTags.map((t) => t.id));
      setSearchResults((res.data ?? []).filter((tag) => !linkedIds.has(tag.id)));
    } catch {
      setSearchError('Could not load tags. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [linkedTags]);

  useEffect(() => {
    void fetchResults(debouncedQ);
  }, [debouncedQ, fetchResults]);

  // ── Link handler ──────────────────────────────────────────────────────────
  async function handleSelectTag(tagId: string, tagObject?: AdminTag) {
    if (linkedTags.some((t) => t.id === tagId)) return;

    const newIds = [...linkedTags.map((t) => t.id), tagId];

    if (entryId !== undefined) {
      try {
        await entriesApi.setTags(entryId, newIds);
        onLinkChanged?.();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to link tag: ${message}`);
        return;
      }
    }

    const fullTag: AdminTag = tagObject
      ?? searchResults.find((t) => t.id === tagId)
      ?? { id: tagId, translations: [], entry_count: 0 };

    onTagsChange(newIds);
    onTagObjectsChange?.([...linkedTags, fullTag]);

    setSearchInput('');
    setDebouncedQ('');
    setSearchResults([]);
    setSearchOpen(false);
  }

  // ── Unlink handler ────────────────────────────────────────────────────────
  async function handleRemoveTag(tagId: string) {
    const newIds = linkedTags.map((t) => t.id).filter((id) => id !== tagId);

    if (entryId !== undefined) {
      try {
        await entriesApi.setTags(entryId, newIds);
        onLinkChanged?.();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        toast.error(`Failed to remove tag: ${message}`);
        return;
      }
    }

    onTagsChange(newIds);
    onTagObjectsChange?.(linkedTags.filter((t) => t.id !== tagId));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Tags
      </Label>

      {/* Linked tag cards */}
      {linkedTags.length > 0 ? (
        <ul className="space-y-2" aria-label="Linked tags">
          {linkedTags.map((tag) => {
            const { label, isFallback } = resolveTagLabel(tag, activeLocale);
            return (
              <TagCard
                key={tag.id}
                tag={tag}
                label={label}
                isFallback={isFallback}
                disabled={disabled}
                onEdit={() => setEditTarget(tag)}
                onRemove={() => setRemoveTarget(tag)}
              />
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-400 py-1">No tags linked yet.</p>
      )}

      {/* Action row */}
      <div className="flex gap-2">
        {/* Search popover */}
        <AddTagCombobox
          open={searchOpen}
          onOpenChange={setSearchOpen}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          results={searchResults}
          isSearching={isSearching}
          searchError={searchError}
          onSelect={handleSelectTag}
          disabled={disabled}
          activeLocale={activeLocale}
        />

        {/* Add new tag button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-start gap-1.5 text-xs"
          disabled={disabled}
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus size={13} aria-hidden="true" />
          Add
        </Button>
      </div>

      {/* Create tag dialog */}
      <TagCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(newTag) => {
          void handleSelectTag(newTag.id, newTag);
        }}
        queryKey={['tags']}
      />

      {/* Edit tag dialog */}
      {editTarget && (
        <TagEditDialog
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          tag={editTarget}
          onSaved={(updatedTag) => {
            onTagObjectsChange?.(
              linkedTags.map((t) => t.id === updatedTag.id ? updatedTag : t),
            );
            setEditTarget(null);
          }}
          queryKey={['tags']}
        />
      )}

      {/* Remove confirm dialog */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title="Remove tag"
        description={
          removeTarget
            ? `Remove "${resolveTagLabel(removeTarget, activeLocale).label}" from this entry? The tag itself will not be deleted.`
            : 'Remove this tag from this entry?'
        }
        confirmLabel="Remove"
        loadingLabel="Removing…"
        onConfirm={() => {
          if (!removeTarget) return;
          void handleRemoveTag(removeTarget.id);
          setRemoveTarget(null);
        }}
        loading={false}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagCard sub-component — mirrors AbbreviationCard look
// ---------------------------------------------------------------------------

interface TagCardProps {
  tag: AdminTag;
  label: string;
  isFallback: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}

function TagCard({ tag, label, isFallback, disabled, onEdit, onRemove }: TagCardProps) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-xs">
      {/* Label */}
      <span className="text-sm font-medium text-slate-800 flex-1 truncate flex items-center gap-1">
        {label}
        {isFallback && <MissingTranslationBadge />}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400 disabled:opacity-40"
        aria-label={`Edit tag ${label}`}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400 disabled:opacity-40"
        aria-label={`Remove tag ${label}`}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// AddTagCombobox sub-component
// ---------------------------------------------------------------------------

interface AddTagComboboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  results: AdminTag[];
  isSearching: boolean;
  searchError: string | null;
  onSelect: (tagId: string, tagObject: AdminTag) => void;
  disabled?: boolean;
  activeLocale: string;
}

function AddTagCombobox({
  open,
  onOpenChange,
  searchInput,
  onSearchInputChange,
  results,
  isSearching,
  searchError,
  onSelect,
  disabled,
  activeLocale,
}: AddTagComboboxProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Add tag"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-between rounded-md border border-slate-200 bg-white',
            'px-3 py-2 text-sm text-left shadow-xs transition-colors',
            'hover:border-slate-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'text-slate-400',
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Search size={13} aria-hidden="true" />
            Add tag…
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
            placeholder="Search tags…"
            value={searchInput}
            onValueChange={onSearchInputChange}
          />
          <CommandList>
            {searchError ? (
              <div className="px-3 py-2 text-xs text-red-600" role="alert">
                {searchError}
              </div>
            ) : isSearching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : searchInput.length === 0 ? (
              <CommandEmpty>Type to search tags.</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No matching tags found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((tag) => {
                  const { label, isFallback } = resolveTranslation(
                    tag.translations,
                    activeLocale,
                    (t) => t.name,
                    tag.id,
                  );
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.id}
                      onSelect={() => onSelect(tag.id, tag)}
                      className="gap-2"
                    >
                      <span className="text-sm flex-1 truncate flex items-center gap-1">
                        {label}
                        {isFallback && <MissingTranslationBadge />}
                      </span>
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
