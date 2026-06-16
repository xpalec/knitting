'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Star,
  ChevronsUpDown,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LanguageBadges } from '@/components/ui/language-badges';
import { AbbreviationCreateDialog } from '@/components/abbreviations/abbreviation-create-dialog';
import { AbbreviationEditDialog } from '@/components/abbreviations/abbreviation-edit-dialog';

import {
  abbreviationsApi,
  type Abbreviation,
  type EntryAbbreviation,
} from '@/lib/api/abbreviations';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AbbreviationsPanelProps {
  entryId: string;
  entryOriginLanguage: string;
  linkedAbbreviations: (EntryAbbreviation & { abbreviation: Abbreviation })[];
  onLinkChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AbbreviationsPanel({
  entryId,
  entryOriginLanguage,
  linkedAbbreviations,
  onLinkChanged,
}: AbbreviationsPanelProps) {
  // ── Dialog state ──────────────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Abbreviation | null>(null);
  const [removeTarget, setRemoveTarget] = useState<(EntryAbbreviation & { abbreviation: Abbreviation }) | null>(null);

  // ── Add-existing combobox state ───────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [searchResults, setSearchResults] = useState<Abbreviation[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // ── 300 ms debounce on combobox input ────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Fetch search results when debounced query changes ────────────────────
  const fetchResults = useCallback(async (q: string) => {
    if (!q || q.length === 0) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await abbreviationsApi.listAbbreviations({
        q,
        source_language: entryOriginLanguage,
        limit: 20,
      });
      // Filter out already-linked abbreviations
      const linkedIds = new Set(linkedAbbreviations.map((la) => la.abbreviation_id));
      setSearchResults((res.data ?? []).filter((a) => !linkedIds.has(a.id)));
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [entryOriginLanguage, linkedAbbreviations]);

  useEffect(() => {
    void fetchResults(debouncedQ);
  }, [debouncedQ, fetchResults]);

  // ── Link existing abbreviation ────────────────────────────────────────────
  const linkMutation = useMutation({
    mutationFn: (abbreviationId: string) =>
      abbreviationsApi.linkAbbreviation(entryId, { abbreviation_id: abbreviationId }),
    onSuccess: (_data, abbreviationId) => {
      const abbr = searchResults.find((a) => a.id === abbreviationId);
      toast.success(`Abbreviation "${abbr?.code ?? abbreviationId}" linked successfully.`);
      setSearchInput('');
      setDebouncedQ('');
      setSearchResults([]);
      setSearchOpen(false);
      onLinkChanged?.();
    },
    onError: (err: Error) => {
      toast.error(`Failed to link abbreviation: ${err.message}`);
    },
  });

  // ── Unlink (remove) abbreviation ──────────────────────────────────────────
  const unlinkMutation = useMutation({
    mutationFn: (abbreviationId: string) =>
      abbreviationsApi.unlinkAbbreviation(entryId, abbreviationId),
    onSuccess: (_data, abbreviationId) => {
      const linked = linkedAbbreviations.find((la) => la.abbreviation_id === abbreviationId);
      toast.success(`Abbreviation "${linked?.abbreviation.code ?? abbreviationId}" removed.`);
      setRemoveTarget(null);
      onLinkChanged?.();
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove abbreviation: ${err.message}`);
      setRemoveTarget(null);
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleLinkAfterCreate(abbreviation: Abbreviation): Promise<void> {
    return abbreviationsApi
      .linkAbbreviation(entryId, { abbreviation_id: abbreviation.id })
      .then(() => {
        onLinkChanged?.();
      });
  }

  function handleSelectExisting(abbreviationId: string) {
    linkMutation.mutate(abbreviationId);
  }

  function handleRemoveConfirm() {
    if (!removeTarget) return;
    unlinkMutation.mutate(removeTarget.abbreviation_id);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Abbreviations
      </Label>

      {/* Linked abbreviation cards */}
      {linkedAbbreviations.length > 0 ? (
        <ul className="space-y-2" aria-label="Linked abbreviations">
          {linkedAbbreviations
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((linked) => (
              <AbbreviationCard
                key={linked.abbreviation_id}
                linked={linked}
                onEdit={() => setEditTarget(linked.abbreviation)}
                onRemove={() => setRemoveTarget(linked)}
              />
            ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400 py-1">No abbreviations linked yet.</p>
      )}

      {/* Action row: Add new + Add existing */}
      <div className="flex flex-col gap-2">
        {/* Add new button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-1.5 text-xs"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus size={13} aria-hidden="true" />
          Add new abbreviation
        </Button>

        {/* Add existing combobox */}
        <AddExistingCombobox
          open={searchOpen}
          onOpenChange={setSearchOpen}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          results={searchResults}
          isSearching={isSearching}
          onSelect={handleSelectExisting}
          isLinking={linkMutation.isPending}
        />
      </div>

      {/* Create dialog */}
      <AbbreviationCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onLinkAfterCreate={handleLinkAfterCreate}
        onCreated={() => {
          onLinkChanged?.();
        }}
        queryKey={['abbreviations']}
      />

      {/* Edit dialog */}
      {editTarget && (
        <AbbreviationEditDialog
          open={editTarget !== null}
          onOpenChange={(open) => { if (!open) setEditTarget(null); }}
          abbreviation={editTarget}
          onSaved={() => {
            onLinkChanged?.();
          }}
          queryKey={['abbreviations']}
        />
      )}

      {/* Remove confirm dialog */}
      <ConfirmDialog
        open={removeTarget !== null}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        title="Remove abbreviation"
        description={
          removeTarget
            ? `Remove "${removeTarget.abbreviation.code}" from this entry? The abbreviation itself will not be deleted.`
            : 'Remove this abbreviation from this entry?'
        }
        confirmLabel="Remove"
        loadingLabel="Removing…"
        onConfirm={handleRemoveConfirm}
        loading={unlinkMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AbbreviationCard sub-component
// ---------------------------------------------------------------------------

interface AbbreviationCardProps {
  linked: EntryAbbreviation & { abbreviation: Abbreviation };
  onEdit: () => void;
  onRemove: () => void;
}

function AbbreviationCard({ linked, onEdit, onRemove }: AbbreviationCardProps) {
  const { abbreviation, is_primary, sort_order } = linked;

  return (
    <li className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-xs">
      {/* Code */}
      <span className="font-mono text-sm font-medium text-slate-800 flex-1 truncate">
        {abbreviation.code}
      </span>

      {/* Source language badge */}
      <LanguageBadges locales={[abbreviation.source_language]} />

      {/* is_primary indicator */}
      {is_primary && (
        <span
          className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
          title="Primary abbreviation"
        >
          <Star size={9} aria-hidden="true" className="fill-amber-500 text-amber-500" />
          Primary
        </span>
      )}

      {/* Sort order */}
      <span
        className="text-[10px] text-slate-400 font-mono tabular-nums"
        title={`Sort order: ${sort_order}`}
      >
        #{sort_order}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={onEdit}
        className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
        aria-label={`Edit abbreviation ${abbreviation.code}`}
      >
        <Pencil size={13} aria-hidden="true" />
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
        aria-label={`Remove abbreviation ${abbreviation.code}`}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// AddExistingCombobox sub-component
// ---------------------------------------------------------------------------

interface AddExistingComboboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  results: Abbreviation[];
  isSearching: boolean;
  onSelect: (abbreviationId: string) => void;
  isLinking: boolean;
}

function AddExistingCombobox({
  open,
  onOpenChange,
  searchInput,
  onSearchInputChange,
  results,
  isSearching,
  onSelect,
  isLinking,
}: AddExistingComboboxProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Add existing abbreviation"
          disabled={isLinking}
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
            Add existing abbreviation…
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
            placeholder="Search abbreviations…"
            value={searchInput}
            onValueChange={onSearchInputChange}
          />
          <CommandList>
            {isSearching ? (
              <CommandEmpty>Searching…</CommandEmpty>
            ) : searchInput.length === 0 ? (
              <CommandEmpty>Type to search abbreviations.</CommandEmpty>
            ) : results.length === 0 ? (
              <CommandEmpty>No matching abbreviations found.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((abbr) => (
                  <CommandItem
                    key={abbr.id}
                    value={abbr.id}
                    onSelect={() => onSelect(abbr.id)}
                    className="gap-2"
                  >
                    <span className="font-mono text-sm font-medium flex-1 truncate">
                      {abbr.code}
                    </span>
                    <LanguageBadges locales={[abbr.source_language]} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
