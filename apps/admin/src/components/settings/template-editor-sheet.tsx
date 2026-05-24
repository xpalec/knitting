'use client';

import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronUp, ChevronDown, X, TriangleAlert } from 'lucide-react';

import { templatesApi } from '@/lib/api/templates';
import type { BlockTemplate, BlockTemplateItem } from '@/lib/api/templates';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BLOCK_TYPE_OPTIONS = [
  'definition',
  'technique',
  'media',
  'callout',
  'related',
  'pattern_usage',
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplateEditorSheetProps {
  template: BlockTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for property-based tests)
// ---------------------------------------------------------------------------

/** Renumber all blocks so order === index + 1 (1-based contiguous). */
export function renumber(blocks: BlockTemplateItem[]): BlockTemplateItem[] {
  return blocks.map((b, i) => ({ ...b, order: i + 1 }));
}

/** Swap block at `index` with the block above it and renumber. */
export function moveUp(blocks: BlockTemplateItem[], index: number): BlockTemplateItem[] {
  if (index <= 0 || index >= blocks.length) return blocks;
  const next = [...blocks];
  const above = next[index - 1] as BlockTemplateItem;
  const current = next[index] as BlockTemplateItem;
  next[index - 1] = current;
  next[index] = above;
  return renumber(next);
}

/** Swap block at `index` with the block below it and renumber. */
export function moveDown(blocks: BlockTemplateItem[], index: number): BlockTemplateItem[] {
  if (index < 0 || index >= blocks.length - 1) return blocks;
  const next = [...blocks];
  const current = next[index] as BlockTemplateItem;
  const below = next[index + 1] as BlockTemplateItem;
  next[index] = below;
  next[index + 1] = current;
  return renumber(next);
}

/** Remove block at `index` and renumber remaining blocks. */
export function removeBlock(blocks: BlockTemplateItem[], index: number): BlockTemplateItem[] {
  return renumber(blocks.filter((_, i) => i !== index));
}

/** Toggle `visible` for block at `index`, leaving all others unchanged. */
export function toggleVisible(blocks: BlockTemplateItem[], index: number): BlockTemplateItem[] {
  return blocks.map((b, i) => (i === index ? { ...b, visible: !b.visible } : b));
}

/** Append a new block of the given type. */
export function addBlock(blocks: BlockTemplateItem[], type: string): BlockTemplateItem[] {
  return [...blocks, { type, order: blocks.length + 1, visible: true }];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateEditorSheet({
  template,
  open,
  onOpenChange,
  onSaved,
}: TemplateEditorSheetProps) {
  const [blocks, setBlocks] = useState<BlockTemplateItem[]>([]);
  const [newBlockType, setNewBlockType] = useState<string>(BLOCK_TYPE_OPTIONS[0] ?? 'definition');

  // Reset local state whenever the template changes (i.e. on each open).
  useEffect(() => {
    if (template) {
      setBlocks(template.blocks ?? []);
    }
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!template) return Promise.reject(new Error('No template selected'));
      return templatesApi.updateTemplate(template.entry_type, blocks);
    },
    onSuccess: () => {
      toast.success('Template saved');
      onSaved();
      onOpenChange(false);
    },
    onError: () => toast.error('Failed to save template'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[480px] sm:max-w-[480px] overflow-y-auto flex flex-col"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="capitalize">
            Edit Template: {template?.entry_type ?? ''}
          </SheetTitle>
        </SheetHeader>

        {/* Warning banner */}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p>Changes apply to new entries only. Existing entries are not affected.</p>
        </div>

        {/* Block list */}
        <div className="flex-1 space-y-1 mb-4">
          {blocks.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No blocks yet.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {blocks.map((block, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2.5"
                >
                  {/* Order number */}
                  <span className="w-5 text-right text-xs text-slate-400 shrink-0">
                    {block.order}
                  </span>

                  {/* Type badge */}
                  <Badge variant="outline" className="capitalize shrink-0">
                    {block.type}
                  </Badge>

                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={i === 0}
                      onClick={() => setBlocks((prev) => moveUp(prev, i))}
                      aria-label={`Move ${block.type} block up`}
                    >
                      <ChevronUp className="h-3 w-3" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      disabled={i === blocks.length - 1}
                      onClick={() => setBlocks((prev) => moveDown(prev, i))}
                      aria-label={`Move ${block.type} block down`}
                    >
                      <ChevronDown className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>

                  {/* Visibility checkbox */}
                  <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={block.visible}
                      onChange={() => setBlocks((prev) => toggleVisible(prev, i))}
                      className="h-4 w-4 rounded border-slate-300 accent-slate-700"
                    />
                    Visible
                  </label>

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500 shrink-0"
                    onClick={() => setBlocks((prev) => removeBlock(prev, i))}
                    aria-label={`Remove ${block.type} block`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add block row */}
        <div className="flex items-center gap-2 mb-6">
          <Select value={newBlockType} onValueChange={setNewBlockType}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BLOCK_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBlocks((prev) => addBlock(prev, newBlockType))}
          >
            Add
          </Button>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !template}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
