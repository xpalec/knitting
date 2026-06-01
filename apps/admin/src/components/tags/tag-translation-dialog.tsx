'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TagTranslationStatus, UpsertTagTranslationPayload } from '@/lib/api/tags';

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

function toSlug(value: string): string {
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

export interface TagTranslationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  initialValues?: {
    name: string;
    slug: string;
    seo_title?: string | null;
    seo_description?: string | null;
    status: TagTranslationStatus;
  };
  onSubmit: (payload: UpsertTagTranslationPayload) => void | Promise<void>;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: TagTranslationStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft' },
  { value: 'reviewed',  label: 'Reviewed' },
  { value: 'published', label: 'Published' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagTranslationDialog({
  open,
  onOpenChange,
  locale,
  initialValues,
  onSubmit,
  isSubmitting,
}: TagTranslationDialogProps) {
  const isEditing = initialValues !== undefined;

  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(
    () => Boolean(initialValues?.slug),
  );
  const [seoTitle, setSeoTitle] = useState(initialValues?.seo_title ?? '');
  const [seoDescription, setSeoDescription] = useState(initialValues?.seo_description ?? '');
  const [status, setStatus] = useState<TagTranslationStatus>(
    initialValues?.status ?? 'draft',
  );

  // Re-populate fields when initialValues or open state changes
  useEffect(() => {
    if (open) {
      setName(initialValues?.name ?? '');
      setSlug(initialValues?.slug ?? '');
      setSlugManuallyEdited(Boolean(initialValues?.slug));
      setSeoTitle(initialValues?.seo_title ?? '');
      setSeoDescription(initialValues?.seo_description ?? '');
      setStatus(initialValues?.status ?? 'draft');
    }
  }, [open, initialValues]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    const payload: UpsertTagTranslationPayload = {
      name: name.trim(),
      slug: slug.trim(),
      ...(seoTitle.trim() ? { seo_title: seoTitle.trim() } : {}),
      ...(seoDescription.trim() ? { seo_description: seoDescription.trim() } : {}),
      status,
    };

    await onSubmit(payload);
  }

  const isSubmitDisabled = isSubmitting || !name.trim() || !slug.trim();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? `Edit Translation — ${locale.toUpperCase()}`
              : `Add Translation — ${locale.toUpperCase()}`}
          </DialogTitle>
        </DialogHeader>

        <form id="tag-translation-form" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-translation-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tag-translation-name"
                placeholder="e.g. Fair Isle"
                value={name}
                onChange={handleNameChange}
                disabled={isSubmitting}
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-translation-slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tag-translation-slug"
                placeholder="e.g. fair-isle"
                value={slug}
                onChange={handleSlugChange}
                disabled={isSubmitting}
                className="font-mono"
              />
              <p className="text-xs text-slate-400">
                Locale-specific URL slug. Auto-generated from name, or set manually.
              </p>
            </div>

            {/* SEO Title */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-translation-seo-title">
                SEO Title
                <span className="ml-1 text-xs text-slate-400">(≤60 chars)</span>
              </Label>
              <Input
                id="tag-translation-seo-title"
                placeholder="e.g. Fair Isle Knitting — Encyclopedia"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                maxLength={60}
                disabled={isSubmitting}
              />
              <p className="text-xs text-slate-400">
                {seoTitle.length}/60 — falls back to name if empty.
              </p>
            </div>

            {/* SEO Description */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-translation-seo-description">
                SEO Description
                <span className="ml-1 text-xs text-slate-400">(≤160 chars)</span>
              </Label>
              <Textarea
                id="tag-translation-seo-description"
                placeholder="e.g. Explore Fair Isle knitting terms, techniques, and traditions."
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                maxLength={160}
                rows={3}
                disabled={isSubmitting}
              />
              <p className="text-xs text-slate-400">
                {seoDescription.length}/160
              </p>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-translation-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TagTranslationStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="tag-translation-status">
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
          </div>
        </form>

        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="tag-translation-form"
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Translation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
