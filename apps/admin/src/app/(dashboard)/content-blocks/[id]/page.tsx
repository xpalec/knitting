'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { contentBlockTypesApi, SUPPORTED_LOCALES } from '@/lib/api/content-block-types';
import type { ContentBlockType, Locale } from '@/lib/api/content-block-types';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { ContentBlockForm } from '@/components/content-blocks/content-block-form';
import type { ContentBlockFormValues } from '@/components/content-blocks/content-block-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Helper — map API response to form default values
// ---------------------------------------------------------------------------

function mapBlockTypeToFormValues(bt: ContentBlockType): ContentBlockFormValues {
  const locales = {} as ContentBlockFormValues['locales'];
  for (const locale of SUPPORTED_LOCALES) {
    locales[locale] = { heading: bt.translations[locale]?.heading ?? '' };
  }
  return {
    label: bt.label,
    type: bt.type,
    color: bt.color ?? '',
    locales,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContentBlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const { data: blockType, isLoading, isError, error } = useQuery({
    queryKey: ['content-block-types', id],
    queryFn: () => contentBlockTypesApi.getById(id),
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 404) {
      toast.error('Block type not found');
      router.replace('/content-blocks');
    }
  }, [isError, error, router]);

  // ── Update mutation ────────────────────────────────────────────────────────

  const updateMutation = useMutation({
    mutationFn: async (values: ContentBlockFormValues) => {
      // Update label/color (type slug is immutable after creation)
      await contentBlockTypesApi.update(id, {
        label: values.label,
        color: values.color || undefined,
      });

      // Upsert all translations (even empty ones — API stores empty heading as "incomplete")
      await Promise.all(
        (Object.keys(values.locales) as Locale[]).map((locale) =>
          contentBlockTypesApi.upsertTranslation(id, locale, {
            heading: values.locales[locale].heading.trim(),
          }),
        ),
      );
    },
    onSuccess: () => {
      toast.success('Block type saved');
      queryClient.invalidateQueries({ queryKey: ['content-block-types', id] });
      queryClient.invalidateQueries({ queryKey: ['content-block-types'] });
    },
    onError: () => toast.error('Failed to save block type'),
  });

  // ── Delete mutation ────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: () => contentBlockTypesApi.delete(id),
    onSuccess: () => {
      toast.success('Block type deleted');
      queryClient.invalidateQueries({ queryKey: ['content-block-types'] });
      router.push('/content-blocks');
    },
    onError: () => {
      setDeleteDialogOpen(false);
      toast.error('Failed to delete block type');
    },
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="rounded-lg border border-slate-200 p-5 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
          <div className="w-[280px] space-y-4">
            <div className="rounded-lg border border-slate-200 p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !blockType) return null;

  // ── 404 / generic error are handled by the useEffect redirect above ────────

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-6">
        {/* Back link */}
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-slate-600 -ml-2">
            <Link href="/content-blocks">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to Content Blocks
            </Link>
          </Button>
        </div>

        <ContentBlockForm
          defaultValues={mapBlockTypeToFormValues(blockType)}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
          onCancel={() => router.push('/content-blocks')}
          onDelete={() => setDeleteDialogOpen(true)}
          title={blockType.label}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Block Type"
        description={`Are you sure you want to delete "${blockType.label}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
