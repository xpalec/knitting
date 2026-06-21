'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  CircleFadingPlus,
  Star,
  Trash2,
  CheckCircle2,
  Circle,
} from 'lucide-react';

import { useAuthStore } from '@/store/auth';
import { useLanguagesStore, KNOWN_LANGUAGES } from '@/store/languages';
import type { Language, LanguageStatus } from '@/store/languages';
import { PageHeader } from '@/components/layout/page-header';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<LanguageStatus, string> = {
  published: 'bg-green-50 text-green-700 border-green-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
};

const STATUS_DOT: Record<LanguageStatus, string> = {
  published: 'bg-green-500',
  draft: 'bg-slate-400',
};

function StatusBadge({ status }: { status: LanguageStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border',
        STATUS_STYLES[status],
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {status === 'published' ? 'Published' : 'Draft'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Add Language dialog
// ---------------------------------------------------------------------------

interface AddLanguageDialogProps {
  open: boolean;
  existingLocales: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (locale: string) => void;
}

function AddLanguageDialog({
  open,
  existingLocales,
  onOpenChange,
  onAdd,
}: AddLanguageDialogProps) {
  const [selected, setSelected] = useState<string>('');

  const available = KNOWN_LANGUAGES.filter(
    (l) => !existingLocales.includes(l.locale),
  );

  function handleAdd() {
    if (!selected) return;
    onAdd(selected);
    setSelected('');
    onOpenChange(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) setSelected('');
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Language</DialogTitle>
          <DialogDescription>
            Select a language to add to your translation system. New languages
            start as&nbsp;<strong>Draft</strong> — they&apos;ll appear in admin
            translation tabs immediately, but won&apos;t be visible to frontend
            users until published.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {available.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              All supported languages are already added.
            </p>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a language…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((l) => (
                  <SelectItem key={l.locale} value={l.locale}>
                    <span className="font-medium">{l.name}</span>
                    <span className="ml-2 text-slate-400 text-xs">
                      {l.nativeName} · {l.locale}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selected || available.length === 0}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            Add language
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Remove confirm dialog
// ---------------------------------------------------------------------------

interface RemoveDialogProps {
  language: Language | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function RemoveDialog({ language, onOpenChange, onConfirm }: RemoveDialogProps) {
  return (
    <Dialog open={language !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Remove Language</DialogTitle>
          <DialogDescription>
            Remove <strong>{language?.name}</strong> from the translation system?
            Existing translations for this language will remain in the database but
            won&apos;t be accessible from the admin UI until the language is
            re-added.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LanguagesSettingsPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const router = useRouter();

  const languages = useLanguagesStore((s) => s.languages);
  const addLanguage = useLanguagesStore((s) => s.addLanguage);
  const updateLanguageStatus = useLanguagesStore((s) => s.updateLanguageStatus);
  const removeLanguage = useLanguagesStore((s) => s.removeLanguage);
  const setDefault = useLanguagesStore((s) => s.setDefault);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Language | null>(null);

  // Role guard — admin only
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const publishedCount = languages.filter((l) => l.status === 'published').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Languages"
        description="Manage the languages available for content translation. Published languages appear as tabs when editing entries, categories, tags, and articles."
      />

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Total
            </p>
            <p className="text-2xl font-bold text-slate-800">{languages.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">languages configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Published
            </p>
            <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">visible to editors</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
              Draft
            </p>
            <p className="text-2xl font-bold text-slate-500">
              {languages.length - publishedCount}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">not yet published</p>
          </CardContent>
        </Card>
      </div>

      {/* Table card */}
      <Card>
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700">
            <Globe size={16} aria-hidden="true" />
            <span className="text-sm font-semibold">Configured Languages</span>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white h-8"
            onClick={() => setAddDialogOpen(true)}
          >
            <CircleFadingPlus size={14} aria-hidden="true" />
            Add language
          </Button>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Language</TableHead>
                <TableHead>Locale code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Globe size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm">No languages configured yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                languages.map((lang) => (
                  <TableRow key={lang.locale}>
                    {/* Name */}
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{lang.name}</p>
                        <p className="text-xs text-slate-400">{lang.nativeName}</p>
                      </div>
                    </TableCell>

                    {/* Locale code */}
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {lang.locale}
                      </Badge>
                    </TableCell>

                    {/* Status — inline toggle */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() =>
                          updateLanguageStatus(
                            lang.locale,
                            lang.status === 'published' ? 'draft' : 'published',
                          )
                        }
                        className="focus:outline-none"
                        aria-label={`Toggle status for ${lang.name}`}
                        title={
                          lang.status === 'published'
                            ? 'Click to set as Draft'
                            : 'Click to Publish'
                        }
                      >
                        <StatusBadge status={lang.status} />
                      </button>
                    </TableCell>

                    {/* Default marker */}
                    <TableCell>
                      {lang.isDefault ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium"
                          aria-label="Default language"
                        >
                          <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                          Default
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDefault(lang.locale)}
                          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                          title="Set as default language"
                        >
                          <Star size={13} aria-hidden="true" />
                          Set default
                        </button>
                      )}
                    </TableCell>

                    {/* Added date */}
                    <TableCell className="text-slate-400 text-sm whitespace-nowrap">
                      {formatDate(lang.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-400"
                            aria-label={`Actions for ${lang.name}`}
                          >
                            <span className="sr-only">Open menu</span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <circle cx="12" cy="5" r="1.5" />
                              <circle cx="12" cy="12" r="1.5" />
                              <circle cx="12" cy="19" r="1.5" />
                            </svg>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {lang.status === 'draft' ? (
                            <DropdownMenuItem
                              onClick={() => updateLanguageStatus(lang.locale, 'published')}
                            >
                              <CheckCircle2 size={13} className="mr-1.5 text-green-500" aria-hidden="true" />
                              Publish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => updateLanguageStatus(lang.locale, 'draft')}
                            >
                              <Circle size={13} className="mr-1.5 text-slate-400" aria-hidden="true" />
                              Set as Draft
                            </DropdownMenuItem>
                          )}
                          {!lang.isDefault && (
                            <DropdownMenuItem onClick={() => setDefault(lang.locale)}>
                              <Star size={13} className="mr-1.5 text-amber-400" aria-hidden="true" />
                              Set as Default
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={lang.isDefault}
                            className={cn(
                              'text-red-600 focus:text-red-600',
                              lang.isDefault && 'opacity-40 cursor-not-allowed',
                            )}
                            onClick={() => {
                              if (!lang.isDefault) setRemoveTarget(lang);
                            }}
                          >
                            <Trash2 size={13} className="mr-1.5" aria-hidden="true" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info callout */}
      <div className="rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
        <p>
          <strong>All configured languages</strong> appear as translation tabs in the admin when
          editing entries, categories, tags, and articles — regardless of status. Set a language
          to <strong>Published</strong> when it&apos;s ready to be visible to frontend users.
          <strong> Draft</strong> languages are admin-only.
        </p>
      </div>

      {/* Dialogs */}
      <AddLanguageDialog
        open={addDialogOpen}
        existingLocales={languages.map((l) => l.locale)}
        onOpenChange={setAddDialogOpen}
        onAdd={addLanguage}
      />

      <RemoveDialog
        language={removeTarget}
        onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}
        onConfirm={() => {
          if (removeTarget) removeLanguage(removeTarget.locale);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
