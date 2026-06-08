'use client';

import { useState } from 'react';
import { Save, Trash2, X, GripVertical, TriangleAlert, MoreHorizontal, CirclePlus } from 'lucide-react';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { APP_COLORS, colorSlotFromBg, type AppColorKey } from '@/lib/colors';
import type { ContentBlockType } from '@/lib/api/content-block-types';
import type { EntryTemplateBlock } from '@/lib/api/entry-templates';

// ---------------------------------------------------------------------------
// Pure helpers (exported for property-based tests)
// ---------------------------------------------------------------------------

/** Renumber all blocks so order === index + 1 (1-based contiguous). */
export function renumber(blocks: EntryTemplateBlock[]): EntryTemplateBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i + 1 }));
}

/** Swap block at `index` with the block above it and renumber. */
export function moveUp(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  if (index <= 0 || index >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
  return renumber(next);
}

/** Swap block at `index` with the block below it and renumber. */
export function moveDown(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  if (index < 0 || index >= blocks.length - 1) return blocks;
  const next = [...blocks];
  [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
  return renumber(next);
}

/** Remove block at `index` and renumber remaining blocks. */
export function removeBlock(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  return renumber(blocks.filter((_, i) => i !== index));
}

/** Toggle `required` for block at `index`, leaving all others unchanged. */
export function toggleRequired(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  return blocks.map((b, i) => (i === index ? { ...b, required: !b.required } : b));
}

/** Append a new block of the given type with required=false. */
export function addBlock(blocks: EntryTemplateBlock[], type: string): EntryTemplateBlock[] {
  return [...blocks, { type, order: blocks.length + 1, required: false }];
}

// ---------------------------------------------------------------------------
// Color palette — ordered list for the picker
// ---------------------------------------------------------------------------

const COLOR_KEYS = Object.keys(APP_COLORS) as AppColorKey[];

// ---------------------------------------------------------------------------
// Internal type — block with a stable drag id
// ---------------------------------------------------------------------------

interface BlockWithId extends EntryTemplateBlock {
  _id: string;
}

let _idCounter = 0;
function nextId(): string {
  return `block-${++_idCounter}`;
}

function attachIds(blocks: EntryTemplateBlock[]): BlockWithId[] {
  return blocks.map((b) => ({ ...b, _id: nextId() }));
}

function stripIds(blocks: BlockWithId[]): EntryTemplateBlock[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return blocks.map(({ _id, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

export interface EntryTemplateFormValues {
  name: string;
  description: string;
  color: string;
  blocks: EntryTemplateBlock[];
}

export interface EntryTemplateFormProps {
  defaultValues?: Partial<EntryTemplateFormValues>;
  blockTypes?: ContentBlockType[];
  isLoadingBlockTypes?: boolean;
  onSubmit: (values: EntryTemplateFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onDelete?: () => void;
  title?: string;
}

// ---------------------------------------------------------------------------
// Block color indicator — small coloured square
// ---------------------------------------------------------------------------

function BlockColorDot({ colorBg }: { colorBg: string }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 rounded-md"
      style={{ backgroundColor: colorBg }}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// Sortable block row
// ---------------------------------------------------------------------------

interface BlockItemRowProps {
  block: BlockWithId;
  blockTypes?: ContentBlockType[];
  isSubmitting?: boolean;
  onToggleRequired: () => void;
  onRemove: () => void;
}

function BlockItemRow({
  block,
  blockTypes,
  isSubmitting,
  onToggleRequired,
  onRemove,
}: BlockItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const matchedType = blockTypes?.find((bt) => bt.type === block.type);
  const label = matchedType?.label ?? block.type;
  // Use the matched ContentBlockType's color if available, else a neutral grey
  const colorBg = matchedType?.color ?? '#EEEEF2';
  const isUnknown = !matchedType;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-white',
        isDragging && 'opacity-50 shadow-lg z-50 rounded-md',
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>

      {/* Colour square */}
      <BlockColorDot colorBg={colorBg} />

      {/* Block name + type subtitle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{label}</p>
        {isUnknown ? (
          <p className="flex items-center gap-1 text-xs text-amber-500">
            <TriangleAlert size={11} aria-hidden="true" />
            Unknown block type
          </p>
        ) : (
          <p className="text-xs text-slate-400 truncate">{block.type}</p>
        )}
      </div>

      {/* Required / Optional toggle badge */}
      <button
        type="button"
        onClick={onToggleRequired}
        disabled={isSubmitting}
        className="shrink-0"
        aria-label={`Toggle ${block.required ? 'Optional' : 'Required'}`}
      >
        {block.required ? (
          <span className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium bg-green-100 text-green-700">
            Required
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-0.5 text-xs font-medium text-slate-500">
            Optional
          </span>
        )}
      </button>

      {/* ⋮ Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            type="button"
            size="icon"
            disabled={isSubmitting}
            className="h-7 w-7 shrink-0 text-slate-400 hover:text-slate-600"
            aria-label="Block actions"
          >
            <MoreHorizontal size={15} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={onRemove}
          >
            <X size={14} aria-hidden="true" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add block — combobox (Popover + Command)
// ---------------------------------------------------------------------------

interface AddBlockRowProps {
  blockTypes?: ContentBlockType[];
  isLoading?: boolean;
  isSubmitting?: boolean;
  onAdd: (type: string) => void;
}

function AddBlockRow({ blockTypes, isLoading, isSubmitting, onAdd }: AddBlockRowProps) {
  const [open, setOpen] = useState(false);
  const hasBlockTypes = blockTypes && blockTypes.length > 0;
  const disabled = isSubmitting || isLoading || !hasBlockTypes;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300',
            'py-2.5 text-sm text-slate-500 transition-colors',
            'hover:border-violet-400 hover:text-violet-600',
            'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-500',
          )}
        >
          <CirclePlus size={15} aria-hidden="true" />
          {isLoading ? 'Loading block types…' : 'Add block'}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[320px]"
        align="start"
        sideOffset={6}
      >
        <Command>
          <CommandInput placeholder="Search block types…" />
          <CommandList>
            <CommandEmpty>No block types found.</CommandEmpty>
            <CommandGroup>
              {(blockTypes ?? []).map((bt) => (
                <CommandItem
                  key={bt.type}
                  value={bt.label}
                  onSelect={() => {
                    onAdd(bt.type);
                    setOpen(false);
                  }}
                  className="gap-2.5"
                >
                  {/* Color dot */}
                  <span
                    className="inline-flex h-5 w-5 shrink-0 rounded"
                    style={{ backgroundColor: bt.color ?? '#EEEEF2' }}
                    aria-hidden="true"
                  />
                  <span>{bt.label}</span>
                  <span className="ml-auto text-xs text-slate-400 font-mono">{bt.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EntryTemplateForm({
  defaultValues,
  blockTypes,
  isLoadingBlockTypes,
  onSubmit,
  isSubmitting = false,
  onCancel,
  onDelete,
  title,
}: EntryTemplateFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [color, setColor] = useState<string>(
    defaultValues?.color ?? APP_COLORS.violet.bg
  );
  const [blocks, setBlocks] = useState<BlockWithId[]>(() =>
    attachIds(defaultValues?.blocks ?? [])
  );

  const isSubmitDisabled = isSubmitting || !name.trim();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b._id === active.id);
      const newIndex = prev.findIndex((b) => b._id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((b, i) => ({ ...b, order: i + 1 }));
    });
  }

  function buildValues(): EntryTemplateFormValues {
    return { name, description, color, blocks: renumber(stripIds(blocks)) };
  }

  function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit(buildValues());
  }

  const displayTitle = title ?? (name.trim() || 'New template');

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* ── Action buttons row (top-right) ─────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">{displayTitle}</h1>

        <div className="flex items-center gap-2">
          {onDelete && (
            <Button
              variant="outline"
              type="button"
              onClick={onDelete}
              disabled={isSubmitting}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              <Trash2 size={15} aria-hidden="true" /> Delete
            </Button>
          )}
          {onCancel && (
            <Button
              variant="outline"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="gap-2"
            >
              <X size={15} aria-hidden="true" /> Cancel
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSubmitDisabled}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Save size={15} aria-hidden="true" />
            {isSubmitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div className="flex gap-5 items-start">

        {/* ── Left: preview panel ───────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-slate-200 bg-white p-6 min-h-[420px]">
            <p className="text-sm font-semibold text-slate-700 mb-1">Template preview</p>
            <p className="text-xs text-slate-400">This is how editors will see this template</p>

            {/* Preview — shows block structure as simple stacked cards */}
            {blocks.length > 0 && (
              <div className="mt-6 space-y-2">
                {blocks.map((block) => {
                  const matchedType = blockTypes?.find((bt) => bt.type === block.type);
                  const label = matchedType?.label ?? block.type;
                  const colorBg = matchedType?.color ?? '#EEEEF2';
                  return (
                    <div
                      key={block._id}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <span
                        className="inline-flex h-6 w-6 shrink-0 rounded-md"
                        style={{ backgroundColor: colorBg }}
                        aria-hidden="true"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{label}</p>
                        <p className="text-xs text-slate-400 truncate">{block.type}</p>
                      </div>
                      {block.required && (
                        <span className="text-xs text-slate-400">Required</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: form panel ─────────────────────────────────────── */}
        <div className="w-[580px] shrink-0 space-y-4">

          {/* Template name + color card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">

            {/* Template name */}
            <div className="space-y-1.5">
              <Label htmlFor="template-name" className="text-sm font-medium text-slate-700">
                Template name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Stitches"
                disabled={isSubmitting}
                maxLength={255}
                className="h-9"
              />
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">
                Color <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_KEYS.map((key) => {
                  const slot = APP_COLORS[key];
                  const isSelected = color === slot.bg;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={slot.label}
                      onClick={() => setColor(slot.bg)}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all',
                        isSelected
                          ? 'ring-2 ring-offset-2 ring-slate-400'
                          : 'hover:scale-110',
                      )}
                      style={{ backgroundColor: slot.bg }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Template structure card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Template structure</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Add and arrange blocks to define the structure of this template
              </p>
            </div>

            {/* Block list */}
            {blocks.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={blocks.map((b) => b._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="divide-y rounded-lg border border-slate-200 overflow-hidden">
                    {blocks.map((block) => (
                      <BlockItemRow
                        key={block._id}
                        block={block}
                        blockTypes={blockTypes}
                        isSubmitting={isSubmitting}
                        onToggleRequired={() =>
                          setBlocks((prev) => {
                            const idx = prev.findIndex((b) => b._id === block._id);
                            if (idx === -1) return prev;
                            return prev.map((b, i) =>
                              i === idx ? { ...b, required: !b.required } : b
                            );
                          })
                        }
                        onRemove={() =>
                          setBlocks((prev) => {
                            const filtered = prev.filter((b) => b._id !== block._id);
                            return filtered.map((b, i) => ({ ...b, order: i + 1 }));
                          })
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add block — full width dashed button */}
            <AddBlockRow
              blockTypes={blockTypes}
              isLoading={isLoadingBlockTypes}
              isSubmitting={isSubmitting}
              onAdd={(type) =>
                setBlocks((prev) => [
                  ...prev,
                  { type, order: prev.length + 1, required: false, _id: nextId() },
                ])
              }
            />
          </div>

        </div>
      </div>
    </form>
  );
}
