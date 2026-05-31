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
import type { CategoryType, CategoryStatus } from '@/lib/api/categories';

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

/**
 * Converts an arbitrary string into a URL-safe slug.
 * Steps: lowercase → trim → remove non-alphanumeric/non-space chars →
 *        replace whitespace runs with a single hyphen → strip leading/trailing hyphens.
 *
 * Examples:
 *   "Basic Stitches"   → "basic-stitches"
 *   "  Hello World!  " → "hello-world"
 */
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

export interface CategoryFormValues {
  name: string;
  slug: string;
  type: CategoryType | '';
  icon: string;
  sort_order: number;
  cover_image_url: string;
  status: CategoryStatus;
}

interface CategoryFormProps {
  defaultValues?: Partial<CategoryFormValues>;
  onSubmit: (values: CategoryFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  submitLabel?: string;
  slugError?: string;
  onCancel?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: { value: CategoryType; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'abbreviation', label: 'Abbreviation' },
  { value: 'article', label: 'Article' },
];

const STATUS_OPTIONS: { value: CategoryStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryForm({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  submitLabel = 'Save',
  slugError,
  onCancel,
}: CategoryFormProps) {
  // When a slug is pre-populated (edit mode) we treat it as manually set so
  // the auto-generation does not overwrite it.
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    () => Boolean(defaultValues?.slug),
  );

  const [name, setName] = useState(defaultValues?.name ?? '');
  const [slug, setSlug] = useState(defaultValues?.slug ?? '');
  const [type, setType] = useState<CategoryType | ''>(defaultValues?.type ?? '');
  const [icon, setIcon] = useState(defaultValues?.icon ?? '');
  const [sortOrder, setSortOrder] = useState(defaultValues?.sort_order ?? 0);
  const [coverImageUrl, setCoverImageUrl] = useState(defaultValues?.cover_image_url ?? '');
  const [status, setStatus] = useState<CategoryStatus>(defaultValues?.status ?? 'draft');

  // -------------------------------------------------------------------------
  // Submit guard
  // -------------------------------------------------------------------------

  const isSubmitDisabled = isSubmitting || !name.trim() || !type;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newName = e.target.value;
    setName(newName);
    if (!slugManuallyEdited) {
      setSlug(toSlug(newName));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSlugManuallyEdited(true);
    setSlug(e.target.value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;
    onSubmit({
      name,
      slug,
      type: type as CategoryType,
      icon,
      sort_order: sortOrder,
      cover_image_url: coverImageUrl,
      status,
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="category-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="category-name"
              placeholder="e.g. Knitting Techniques"
              value={name}
              onChange={handleNameChange}
              disabled={isSubmitting}
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="category-slug">
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input
              id="category-slug"
              placeholder="e.g. knitting-techniques"
              value={slug}
              onChange={handleSlugChange}
              disabled={isSubmitting}
              className={cn(slugError && 'border-red-400')}
            />
            {slugError ? (
              <p className="text-xs text-red-500">{slugError}</p>
            ) : (
              <p className="text-xs text-slate-400">
                Lowercase letters, numbers, and hyphens only.
              </p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="category-type">
              Type <span className="text-red-500">*</span>
            </Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as CategoryType)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="category-type">
                <SelectValue placeholder="Select a type…" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label htmlFor="category-icon">Icon</Label>
            <Input
              id="category-icon"
              placeholder="e.g. scissors"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Sort Order */}
          <div className="space-y-1.5">
            <Label htmlFor="category-sort-order">Sort Order</Label>
            <Input
              id="category-sort-order"
              type="number"
              placeholder="0"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              disabled={isSubmitting}
            />
          </div>

          {/* Cover Image URL */}
          <div className="space-y-1.5">
            <Label htmlFor="category-cover-image-url">Cover Image URL</Label>
            <Input
              id="category-cover-image-url"
              placeholder="https://example.com/image.jpg"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="category-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as CategoryStatus)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="category-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
