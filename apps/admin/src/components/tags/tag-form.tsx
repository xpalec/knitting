'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TagType } from '@/lib/api/tags';

// ---------------------------------------------------------------------------
// Slug helper (same logic as category-form.tsx)
// ---------------------------------------------------------------------------

export function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TagFormValues {
  slug: string;
  name_en: string;   // only used on create
  type: TagType | '';
  color_hex: string; // empty string = no color
}

interface TagFormProps {
  defaultValues?: Partial<TagFormValues>;
  slugReadOnly?: boolean; // true on edit page (slug is immutable)
  onSubmit: (values: TagFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  slugError?: string;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: TagType; label: string }[] = [
  { value: 'fiber_type',      label: 'Fiber Type' },
  { value: 'needle_type',     label: 'Needle Type' },
  { value: 'garment_part',    label: 'Garment Part' },
  { value: 'style_tradition', label: 'Style Tradition' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagForm({
  defaultValues,
  slugReadOnly = false,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save',
  slugError,
  onCancel,
}: TagFormProps) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    () => Boolean(defaultValues?.slug),
  );

  const [nameEn, setNameEn] = useState(defaultValues?.name_en ?? '');
  const [slug, setSlug] = useState(defaultValues?.slug ?? '');
  const [type, setType] = useState<TagType | ''>(defaultValues?.type ?? '');
  const [colorHex, setColorHex] = useState(defaultValues?.color_hex ?? '');

  // -------------------------------------------------------------------------
  // Submit guard
  // -------------------------------------------------------------------------

  const isSubmitDisabled = isSubmitting || (!slugReadOnly && !slug.trim());

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    setNameEn(newName);
    if (!slugManuallyEdited) {
      setSlug(toSlug(newName));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    setSlug(e.target.value);
  }

  function handleColorPickerChange(e: React.ChangeEvent<HTMLInputElement>) {
    setColorHex(e.target.value);
  }

  function handleColorTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    setColorHex(e.target.value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit({ slug, name_en: nameEn, type, color_hex: colorHex });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* English Name — only shown on create */}
          {!slugReadOnly && (
            <div className="space-y-1.5">
              <Label htmlFor="tag-name-en">
                English Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tag-name-en"
                placeholder="e.g. Fair Isle"
                value={nameEn}
                onChange={handleNameChange}
                disabled={isSubmitting}
              />
            </div>
          )}

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="tag-slug">
              Slug {!slugReadOnly && <span className="text-red-500">*</span>}
            </Label>
            {slugReadOnly ? (
              <code className="block rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700">
                {slug}
              </code>
            ) : (
              <>
                <Input
                  id="tag-slug"
                  placeholder="e.g. fair-isle"
                  value={slug}
                  onChange={handleSlugChange}
                  disabled={isSubmitting}
                  className={cn(slugError && 'border-red-400')}
                />
                {slugError ? (
                  <p className="text-xs text-red-500">{slugError}</p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Lowercase letters, numbers, and hyphens only. Immutable after creation.
                  </p>
                )}
              </>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="tag-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as TagType | '')}
              disabled={isSubmitting}
            >
              <SelectTrigger id="tag-type">
                <SelectValue placeholder="Select a type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color Hex */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colorHex || '#000000'}
                onChange={handleColorPickerChange}
                disabled={isSubmitting}
                className="h-9 w-12 cursor-pointer rounded border border-slate-200 p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Pick color"
              />
              <Input
                placeholder="#RRGGBB or leave empty"
                value={colorHex}
                onChange={handleColorTextChange}
                disabled={isSubmitting}
                className="font-mono"
              />
              {colorHex && (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => setColorHex('')}
                  disabled={isSubmitting}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Optional. Must be a valid hex color (e.g. #228B22).
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 border-t pt-4">
          {onCancel && (
            <Button
              variant="outline"
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSubmitDisabled}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
