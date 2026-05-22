'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { entriesApi } from '@/lib/api/entries';
import type { EntryType, SkillLevel } from '@/lib/api/entries';

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
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTRY_TYPE_OPTIONS: { value: EntryType; label: string }[] = [
  { value: 'stitch', label: 'Stitch' },
  { value: 'technique', label: 'Technique' },
  { value: 'tool', label: 'Tool' },
  { value: 'tradition', label: 'Tradition' },
  { value: 'yarn_weight', label: 'Yarn Weight' },
];

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'en', label: 'English (en)' },
  { value: 'pl', label: 'Polish (pl)' },
];

const SKILL_LEVEL_OPTIONS: { value: SkillLevel; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'expert', label: 'Expert' },
];

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

function toSlug(term: string): string {
  return term
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function NewEntryPage() {
  const router = useRouter();

  // Form state
  const [entryType, setEntryType] = useState<EntryType | ''>('');
  const [originLanguage, setOriginLanguage] = useState<string>('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('');
  const [term, setTerm] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDefinition, setShortDefinition] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleTermChange(value: string) {
    setTerm(value);
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

    if (!entryType) next.entryType = 'Entry type is required.';
    if (!originLanguage) next.originLanguage = 'Origin language is required.';
    if (!skillLevel) next.skillLevel = 'Skill level is required.';
    if (!term.trim()) next.term = 'Term is required.';
    if (!slug.trim()) {
      next.slug = 'Slug is required.';
    } else if (!SLUG_REGEX.test(slug)) {
      next.slug =
        'Slug must be lowercase letters, numbers, and hyphens only (e.g. "my-entry").';
    }
    if (!shortDefinition.trim()) next.shortDefinition = 'Short definition is required.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: () =>
      entriesApi.createEntry({
        type: entryType as EntryType,
        origin_language: originLanguage,
        metadata: {
          skill_level: skillLevel as SkillLevel,
          definition_short: shortDefinition,
        },
        // Extra fields the backend accepts for the initial translation
        ...({ term, slug } as object),
      } as Parameters<typeof entriesApi.createEntry>[0]),
    onSuccess: (entry) => {
      toast.success('Entry created');
      router.push(`/entries/${entry.id}`);
    },
    onError: () => {
      toast.error('Failed to create entry');
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate();
  }

  const isPending = createMutation.isPending;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600">
          <Link href="/entries">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to Entries
          </Link>
        </Button>
      </div>

      <h1 className="text-2xl font-semibold text-slate-800">New Entry</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate>
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="space-y-6 pt-6">
              {/* Entry Type */}
              <div className="space-y-1.5">
                <Label htmlFor="entry-type">
                  Entry Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={entryType}
                  onValueChange={(v) => {
                    setEntryType(v as EntryType);
                    setErrors((prev) => ({ ...prev, entryType: '' }));
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="entry-type"
                    className={cn(errors.entryType && 'border-red-400')}
                  >
                    <SelectValue placeholder="Select a type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.entryType && (
                  <p className="text-xs text-red-500">{errors.entryType}</p>
                )}
              </div>

              {/* Origin Language */}
              <div className="space-y-1.5">
                <Label htmlFor="origin-language">
                  Origin Language <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={originLanguage}
                  onValueChange={(v) => {
                    setOriginLanguage(v);
                    setErrors((prev) => ({ ...prev, originLanguage: '' }));
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="origin-language"
                    className={cn(errors.originLanguage && 'border-red-400')}
                  >
                    <SelectValue placeholder="Select a language…" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.originLanguage && (
                  <p className="text-xs text-red-500">{errors.originLanguage}</p>
                )}
              </div>

              {/* Skill Level */}
              <div className="space-y-1.5">
                <Label htmlFor="skill-level">
                  Skill Level <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={skillLevel}
                  onValueChange={(v) => {
                    setSkillLevel(v as SkillLevel);
                    setErrors((prev) => ({ ...prev, skillLevel: '' }));
                  }}
                  disabled={isPending}
                >
                  <SelectTrigger
                    id="skill-level"
                    className={cn(errors.skillLevel && 'border-red-400')}
                  >
                    <SelectValue placeholder="Select a skill level…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_LEVEL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.skillLevel && (
                  <p className="text-xs text-red-500">{errors.skillLevel}</p>
                )}
              </div>

              <Separator />

              {/* Term — English */}
              <div className="space-y-1.5">
                <Label htmlFor="term-en">
                  Term — English <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="term-en"
                  placeholder="e.g. Knit stitch"
                  value={term}
                  onChange={(e) => {
                    handleTermChange(e.target.value);
                    setErrors((prev) => ({ ...prev, term: '' }));
                  }}
                  disabled={isPending}
                  className={cn(errors.term && 'border-red-400')}
                />
                {errors.term && (
                  <p className="text-xs text-red-500">{errors.term}</p>
                )}
              </div>

              {/* Slug — English */}
              <div className="space-y-1.5">
                <Label htmlFor="slug-en">
                  Slug — English <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="slug-en"
                  placeholder="e.g. knit-stitch"
                  value={slug}
                  onChange={(e) => {
                    handleSlugChange(e.target.value);
                    setErrors((prev) => ({ ...prev, slug: '' }));
                  }}
                  disabled={isPending}
                  className={cn(errors.slug && 'border-red-400')}
                />
                {errors.slug ? (
                  <p className="text-xs text-red-500">{errors.slug}</p>
                ) : (
                  <p className="text-xs text-slate-400">
                    Auto-generated from the term. Lowercase letters, numbers, and hyphens only.
                  </p>
                )}
              </div>

              {/* Short Definition */}
              <div className="space-y-1.5">
                <Label htmlFor="short-definition">
                  Short Definition <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="short-definition"
                  placeholder="A brief description of this entry…"
                  rows={3}
                  value={shortDefinition}
                  onChange={(e) => {
                    setShortDefinition(e.target.value);
                    setErrors((prev) => ({ ...prev, shortDefinition: '' }));
                  }}
                  disabled={isPending}
                  className={cn(errors.shortDefinition && 'border-red-400')}
                />
                {errors.shortDefinition && (
                  <p className="text-xs text-red-500">{errors.shortDefinition}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex justify-end gap-3 border-t pt-4">
              <Button variant="outline" asChild disabled={isPending}>
                <Link href="/entries">Cancel</Link>
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create Entry'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  );
}
