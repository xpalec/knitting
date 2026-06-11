'use client';

import { useState } from 'react';
import { Save, Trash2, X, GripVertical, TriangleAlert, MoreHorizontal, CirclePlus, ChevronDown } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { BLOCK_TYPES, getBlockType } from '@/lib/block-types';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  deriveTemplateTranslationStatus,
  initBlockDefaults,
  removeBlockDefaults,
  setTranslationField,
  type EntryTemplateBlock,
  type TemplateTranslations,
  type Locale,
} from '@/lib/api/entry-templates';

// ---------------------------------------------------------------------------
// Pure block helpers (exported for property-based tests)
// ---------------------------------------------------------------------------

export function renumber(blocks: EntryTemplateBlock[]): EntryTemplateBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i + 1 }));
}

export function moveUp(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  if (index <= 0 || index >= blocks.length) return blocks;
  const next = [...blocks];
  [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
  return renumber(next);
}

export function moveDown(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  if (index < 0 || index >= blocks.length - 1) return blocks;
  const next = [...blocks];
  [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
  return renumber(next);
}

export function removeBlock(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  return renumber(blocks.filter((_, i) => i !== index));
}

export function toggleRequired(blocks: EntryTemplateBlock[], index: number): EntryTemplateBlock[] {
  return blocks.map((b, i) => (i === index ? { ...b, required: !b.required } : b));
}

export function addBlock(blocks: EntryTemplateBlock[], type: string): EntryTemplateBlock[] {
  return [...blocks, { id: crypto.randomUUID(), type, order: blocks.length + 1, required: false }];
}

// ---------------------------------------------------------------------------
// Internal type â€” block with stable drag id
// ---------------------------------------------------------------------------

interface BlockWithDndId extends EntryTemplateBlock {
  _dndId: string;
}

let _dndCounter = 0;
function nextDndId(): string { return `dnd-${++_dndCounter}`; }

function attachDndIds(blocks: EntryTemplateBlock[]): BlockWithDndId[] {
  return blocks.map((b) => ({ ...b, _dndId: nextDndId() }));
}

function stripDndIds(blocks: BlockWithDndId[]): EntryTemplateBlock[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return blocks.map(({ _dndId, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

export interface EntryTemplateFormValues {
  name: string;
  description: string;
  blocks: EntryTemplateBlock[];
  translations: TemplateTranslations;
}

export interface EntryTemplateFormProps {
  defaultValues?: Partial<EntryTemplateFormValues>;
  isSubmitting?: boolean;
  onSubmit: (values: EntryTemplateFormValues) => void | Promise<void>;
  onCancel?: () => void;
  onDelete?: () => void;
  title?: string;
}

// ---------------------------------------------------------------------------
// Sortable block row â€” with inline collapsible translation fields
// ---------------------------------------------------------------------------

interface BlockItemRowProps {
  block: BlockWithDndId;
  locale: string;
  translations: TemplateTranslations;
  isSubmitting?: boolean;
  onToggleRequired: () => void;
  onRemove: () => void;
  onFieldChange: (blockId: string, locale: string, fieldName: string, value: string) => void;
}

function BlockItemRow({
  block,
  locale,
  translations,
  isSubmitting,
  onToggleRequired,
  onRemove,
  onFieldChange,
}: BlockItemRowProps) {
  const [expanded, setExpanded] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block._dndId,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const blockType = getBlockType(block.type);
  const label = blockType?.label ?? block.type;
  const colorBg = blockType?.color ?? '#EEEEF2';
  const isUnknown = !blockType;
  const hasTranslatableFields = (blockType?.translatableFields?.length ?? 0) > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-white',
        isDragging && 'opacity-50 shadow-lg z-50 rounded-md',
      )}
    >
      {/* â”€â”€ Main row â”€â”€ */}
      <div className="flex items-center gap-3 px-4 py-3">
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

        {/* Color dot */}
        <span
          className="inline-flex h-7 w-7 shrink-0 rounded-md"
          style={{ backgroundColor: colorBg }}
          aria-hidden="true"
        />

        {/* Label */}
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

        {/* Required / Optional toggle */}
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

        {/* Expand translation fields (only if block has translatable fields) */}
        {hasTranslatableFields && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={expanded ? 'Hide translation fields' : 'Show translation fields'}
            aria-expanded={expanded}
          >
            <ChevronDown
              size={15}
              className={cn('transition-transform duration-200', expanded && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        )}

        {/* â‹® Actions */}
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
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={onRemove}>
              <X size={14} aria-hidden="true" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* â”€â”€ Collapsible translation fields â”€â”€ */}
      {expanded && hasTranslatableFields && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3 bg-slate-50/60">
          {blockType!.translatableFields.map((field) => (
            <div key={field.name} className="space-y-1.5">
              <Label htmlFor={`${locale}-${block.id}-${field.name}`} className="text-xs text-slate-600">
                {field.label}
              </Label>
              <Input
                id={`${locale}-${block.id}-${field.name}`}
                value={translations[block.id]?.[locale]?.[field.name] ?? ''}
                onChange={(e) => onFieldChange(block.id, locale, field.name, e.target.value)}
                placeholder={`${LOCALE_LABELS[locale as Locale]} ${field.label.toLowerCase()} text`}
                maxLength={field.maxLength}
                disabled={isSubmitting}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add block â€” combobox popover
// ---------------------------------------------------------------------------

function AddBlockRow({
  isSubmitting,
  onAdd,
}: {
  isSubmitting?: boolean;
  onAdd: (type: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={isSubmitting}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300',
            'py-2.5 text-sm text-slate-500 transition-colors',
            'hover:border-violet-400 hover:text-violet-600',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <CirclePlus size={15} aria-hidden="true" />
          Add block
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start" sideOffset={6}>
        <Command>
          <CommandInput placeholder="Search block typesâ€¦" />
          <CommandList>
            <CommandEmpty>No block types found.</CommandEmpty>
            <CommandGroup>
              {BLOCK_TYPES.map((bt) => (
                <CommandItem
                  key={bt.slug}
                  value={bt.label}
                  onSelect={() => { onAdd(bt.slug); setOpen(false); }}
                  className="gap-2.5"
                >
                  <span
                    className="inline-flex h-5 w-5 shrink-0 rounded"
                    style={{ backgroundColor: bt.color }}
                    aria-hidden="true"
                  />
                  <span>{bt.label}</span>
                  <span className="ml-auto text-xs text-slate-400 font-mono">{bt.slug}</span>
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
// Block list with locale tabs at the top
// ---------------------------------------------------------------------------

function BlockListWithTabs({
  blocks,
  translations,
  isSubmitting,
  sensors,
  onDragEnd,
  onToggleRequired,
  onRemove,
  onFieldChange,
  onAdd,
}: {
  blocks: BlockWithDndId[];
  translations: TemplateTranslations;
  isSubmitting: boolean;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  onToggleRequired: (dndId: string) => void;
  onRemove: (dndId: string) => void;
  onFieldChange: (blockId: string, locale: string, fieldName: string, value: string) => void;
  onAdd: (type: string) => void;
}) {
  const plainBlocks = stripDndIds(blocks);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-700">Template structure</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Add blocks, set required/optional, and expand each block to fill in translation defaults
        </p>
      </div>

      <Tabs defaultValue="en">
        {/* Locale tab strip */}
        <TabsList variant="line" className="w-full justify-start">
          {SUPPORTED_LOCALES.map((locale) => {
            const status = deriveTemplateTranslationStatus({ blocks: plainBlocks, translations }, locale);
            return (
              <TabsTrigger key={locale} value={locale} variant="line" className="gap-1.5 items-center">
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0 transition-colors',
                    status === 'complete' ? 'bg-green-500' : 'bg-transparent',
                  )}
                  aria-hidden="true"
                />
                <span>{LOCALE_LABELS[locale]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* One tab panel per locale â€” same block list, different translation values */}
        {SUPPORTED_LOCALES.map((locale) => (
          <TabsContent key={locale} value={locale} className="mt-4 space-y-3">
            {blocks.length > 0 ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={blocks.map((b) => b._dndId)} strategy={verticalListSortingStrategy}>
                  <div className="divide-y rounded-lg border border-slate-200 overflow-hidden">
                    {blocks.map((block) => (
                      <BlockItemRow
                        key={block._dndId}
                        block={block}
                        locale={locale}
                        translations={translations}
                        isSubmitting={isSubmitting}
                        onToggleRequired={() => onToggleRequired(block._dndId)}
                        onRemove={() => onRemove(block._dndId)}
                        onFieldChange={onFieldChange}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="py-4 text-center text-sm text-slate-400">
                No blocks yet. Add one below.
              </p>
            )}

            <AddBlockRow isSubmitting={isSubmitting} onAdd={onAdd} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function EntryTemplateForm({
  defaultValues,
  isSubmitting = false,
  onSubmit,
  onCancel,
  onDelete,
  title,
}: EntryTemplateFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '');
  const [description, setDescription] = useState(defaultValues?.description ?? '');
  const [blocks, setBlocks] = useState<BlockWithDndId[]>(() =>
    attachDndIds(defaultValues?.blocks ?? []),
  );
  const [translations, setTranslations] = useState<TemplateTranslations>(
    defaultValues?.translations ?? {},
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
      const oldIndex = prev.findIndex((b) => b._dndId === active.id);
      const newIndex = prev.findIndex((b) => b._dndId === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex).map((b, i) => ({ ...b, order: i + 1 }));
    });
  }

  function handleAddBlock(type: string) {
    const newId = crypto.randomUUID();
    setBlocks((prev) => [
      ...prev,
      { id: newId, type, order: prev.length + 1, required: false, _dndId: nextDndId() },
    ]);
    setTranslations((t) => initBlockDefaults(t, newId));
  }

  function handleRemoveBlock(dndId: string) {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b._dndId === dndId);
      if (idx === -1) return prev;
      const removedId = prev[idx]!.id;
      setTranslations((t) => removeBlockDefaults(t, removedId));
      return prev.filter((_, i) => i !== idx).map((b, i) => ({ ...b, order: i + 1 }));
    });
  }

  function handleToggleRequired(dndId: string) {
    setBlocks((prev) =>
      prev.map((b) => (b._dndId === dndId ? { ...b, required: !b.required } : b)),
    );
  }

  function handleTranslationFieldChange(
    blockId: string,
    locale: string,
    fieldName: string,
    value: string,
  ) {
    setTranslations((t) => setTranslationField(t, blockId, locale, fieldName, value));
  }

  function buildValues(): EntryTemplateFormValues {
    return {
      name,
      description,
      blocks: renumber(stripDndIds(blocks)),
      translations,
    };
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
      {/* â”€â”€ Title + action buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            <Button variant="outline" type="button" onClick={onCancel} disabled={isSubmitting} className="gap-2">
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
            {isSubmitting ? 'Savingâ€¦' : 'Save'}
          </Button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div className="space-y-4">

        {/* Template details */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Template details</p>

          <div className="space-y-1.5">
            <Label htmlFor="template-name">
              Template name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Technique – Step-by-Step Guide"
              disabled={isSubmitting}
              maxLength={255}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for editors."
              rows={3}
              className="resize-none"
              disabled={isSubmitting}
              maxLength={1000}
            />
          </div>
        </div>

        {/* Block structure + locale tabs + collapsible translation fields */}
        <BlockListWithTabs
          blocks={blocks}
          translations={translations}
          isSubmitting={isSubmitting}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          onToggleRequired={handleToggleRequired}
          onRemove={handleRemoveBlock}
          onFieldChange={handleTranslationFieldChange}
          onAdd={handleAddBlock}
        />
      </div>
    </form>
  );
}
