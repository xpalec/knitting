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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TranslationStatus, UpsertTranslationPayload } from '@/lib/api/categories';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranslationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  initialValues?: {
    name: string;
    slug: string;
    translator_note?: string;
    status: TranslationStatus;
  };
  onSubmit: (payload: UpsertTranslationPayload) => void | Promise<void>;
  isSubmitting: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: { value: TranslationStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'published', label: 'Published' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TranslationDialog({
  open,
  onOpenChange,
  locale,
  initialValues,
  onSubmit,
  isSubmitting,
}: TranslationDialogProps) {
  const isEditing = initialValues !== undefined;

  const [name, setName] = useState(initialValues?.name ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [translatorNote, setTranslatorNote] = useState(
    initialValues?.translator_note ?? '',
  );
  const [status, setStatus] = useState<TranslationStatus>(
    initialValues?.status ?? 'draft',
  );

  // Re-populate fields when initialValues or open state changes
  useEffect(() => {
    if (open) {
      setName(initialValues?.name ?? '');
      setSlug(initialValues?.slug ?? '');
      setTranslatorNote(initialValues?.translator_note ?? '');
      setStatus(initialValues?.status ?? 'draft');
    }
  }, [open, initialValues]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload: UpsertTranslationPayload = {
      name: name.trim(),
      slug: slug.trim(),
      status,
      ...(translatorNote.trim() ? { translator_note: translatorNote.trim() } : {}),
    };

    await onSubmit(payload);
    // Dialog stays open on error — caller handles toast and controls `open`
  }

  const isSubmitDisabled = isSubmitting || !name.trim();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit Translation — ${locale}` : `Add Translation — ${locale}`}
          </DialogTitle>
        </DialogHeader>

        <form id="translation-form" onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 py-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="translation-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="translation-name"
                placeholder="e.g. Knitting Techniques"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="translation-slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="translation-slug"
                placeholder="e.g. knitting-techniques"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-slate-400">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {/* Translator Note */}
            <div className="space-y-1.5">
              <Label htmlFor="translation-note">Translator Note</Label>
              <Input
                id="translation-note"
                placeholder="Optional note for translators"
                value={translatorNote}
                onChange={(e) => setTranslatorNote(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="translation-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TranslationStatus)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="translation-status">
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
            form="translation-form"
            disabled={isSubmitDisabled}
          >
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Translation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
