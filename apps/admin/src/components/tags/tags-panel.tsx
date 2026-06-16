'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, ChevronsUpDown, X } from 'lucide-react';

import { cn } from '@/lib/utils';
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
import { MissingTranslationBadge } from '@/components/ui/missing-translation-badge';

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
  /** Called when the user links or unlinks a tag (updates parent form state). */
  onTagsChange: (tagIds: string[]) => void;
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
  async function handleSelectTag(tagId: string) {
    // Guard against duplicates
    if (linkedTags.some((t) => t.id === tagId)) return;

    if (entryId !== undefined) {
      // Call API immediately if the endpoint exists
      if (typeof (entriesApi as Record<string, unknown>).linkTag === 'function') {
        try {
          await (entriesApi as unknown as { linkTag: (entryId: string, tagId: string) => Promise<unknown> }).linkTag(entryId, tagId);
          onLinkChanged?.();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          toast.error(`Failed to link tag: ${message}`);
          return;
        }
      } else {
        console.warn('[TagsPanel] entriesApi.linkTag not available; skipping API call.');
      }
    }

    // Always update local state
    const newIds = [...linkedTags.map((t) => t.id), tagId];
    onTagsChange(newIds);

    // Reset search
    setSearchInput('');
    setDebouncedQ('');
    setSearchResults([]);
    setSearchOpen(false);
  }

  // ── Unlink handler ────────────────────────────────────────────────────────
  async function handleRemoveTag(tagId: string) {
    if (entryId !== undefined) {
      // Call API immediately if the endpoint exists
      if (typeof (entriesApi as Record<string, unknown>).unlinkTag === 'function') {
        try {
          await (entriesApi as unknown as { unlinkTag: (entryId: string, tagId: string) => Promise<unknown> }).unlinkTag(entryId, tagId);
          onLinkChanged?.();
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          toast.error(`Failed to unlink tag: ${message}`);
          return;
        }
      } else {
        console.warn('[TagsPanel] entriesApi.unlinkTag not available; skipping API call.');
      }
    }

    // Always update local state
    const newIds = linkedTags.map((t) => t.id).filter((id) => id !== tagId);
    onTagsChange(newIds);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Tags
      </Label>

      {/* Linked tag chips */}
      {linkedTags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Linked tags">
          {linkedTags.map((tag) => {
            const { label, isFallback } = resolveTagLabel(tag, activeLocale);
            return (
              <TagChip
                key={tag.id}
                tagId={tag.id}
                label={label}
                isFallback={isFallback}
                disabled={disabled}
                onRemove={handleRemoveTag}
              />
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-400 py-1">No tags linked yet.</p>
      )}

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
    </div>
  );
}

// ---------------------------------------------------------------------------
// TagChip sub-component
// ---------------------------------------------------------------------------

interface TagChipProps {
  tagId: string;
  label: string;
  isFallback: boolean;
  disabled?: boolean;
  onRemove: (tagId: string) => void;
}

function TagChip({ tagId, label, isFallback, disabled, onRemove }: TagChipProps) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 shadow-xs">
      <span className="truncate max-w-[140px] flex items-center gap-1">
        {label}
        {isFallback && <MissingTranslationBadge />}
      </span>
      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(tagId)}
          className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
          aria-label={`Remove tag ${label}`}
        >
          <X size={11} aria-hidden="true" />
        </button>
      )}
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
  onSelect: (tagId: string) => void;
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
                      onSelect={() => onSelect(tag.id)}
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
