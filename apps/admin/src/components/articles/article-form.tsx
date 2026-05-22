'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
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
import { TagsInput } from '@/components/articles/tags-input';
import { CoverImageUpload } from '@/components/articles/cover-image-upload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArticleFormValues {
  title: string;
  slug: string;
  content: string;
  tags: string[];
  country: string;
  author: string;
  cover_image_url: string | undefined;
}

interface ArticleFormProps {
  initialValues?: Partial<ArticleFormValues>;
  onSubmit: (values: ArticleFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNTRY_OPTIONS = [
  { value: 'pl', label: 'Poland' },
  { value: 'no', label: 'Norway' },
  { value: 'de', label: 'Germany / Austria' },
  { value: 'gb', label: 'UK / Ireland' },
  { value: 'fr', label: 'France' },
];

const NO_COUNTRY = '__none__';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArticleForm({
  initialValues,
  onSubmit,
  isSubmitting,
  submitLabel,
  onCancel,
}: ArticleFormProps) {
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [slug, setSlug] = useState(initialValues?.slug ?? '');
  const [content, setContent] = useState(initialValues?.content ?? '');
  const [tags, setTags] = useState<string[]>(initialValues?.tags ?? []);
  const [country, setCountry] = useState(initialValues?.country ?? '');
  const [author, setAuthor] = useState(initialValues?.author ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>(
    initialValues?.cover_image_url
  );
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(toSlug(value));
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value);
    setSlugManuallyEdited(true);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!title.trim()) {
      next.title = 'Title is required.';
    }

    if (!slug.trim()) {
      next.slug = 'Slug is required.';
    } else if (!SLUG_REGEX.test(slug)) {
      next.slug = 'Slug must be lowercase letters, numbers, and hyphens only.';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      title,
      slug,
      content,
      tags,
      country,
      author,
      cover_image_url: coverImageUrl,
    });
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="article-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="article-title"
              placeholder="e.g. Getting started with knitting"
              value={title}
              onChange={(e) => {
                handleTitleChange(e.target.value);
                setErrors((prev) => ({ ...prev, title: '' }));
              }}
              disabled={isSubmitting}
              className={cn(errors.title && 'border-red-400')}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <Label htmlFor="article-slug">
              Slug <span className="text-red-500">*</span>
            </Label>
            <Input
              id="article-slug"
              placeholder="e.g. getting-started-with-knitting"
              value={slug}
              onChange={(e) => {
                handleSlugChange(e.target.value);
                setErrors((prev) => ({ ...prev, slug: '' }));
              }}
              disabled={isSubmitting}
              className={cn(errors.slug && 'border-red-400')}
            />
            {errors.slug ? (
              <p className="text-xs text-red-500">{errors.slug}</p>
            ) : (
              <p className="text-xs text-slate-400">
                Auto-generated from title. Lowercase letters, numbers, and hyphens only.
              </p>
            )}
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="article-content">Content</Label>
            <Textarea
              id="article-content"
              placeholder="Write the article content here…"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagsInput
              value={tags}
              onChange={setTags}
              disabled={isSubmitting}
            />
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label htmlFor="article-country">Country</Label>
            <Select
              value={country || NO_COUNTRY}
              onValueChange={(v) => setCountry(v === NO_COUNTRY ? '' : v)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="article-country">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COUNTRY}>None</SelectItem>
                {COUNTRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Author */}
          <div className="space-y-1.5">
            <Label htmlFor="article-author">Author</Label>
            <Input
              id="article-author"
              placeholder="e.g. Jane Doe"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Cover Image */}
          <div className="space-y-1.5">
            <Label>Cover Image</Label>
            <CoverImageUpload
              value={coverImageUrl}
              onChange={setCoverImageUrl}
              disabled={isSubmitting}
            />
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 border-t pt-4">
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
