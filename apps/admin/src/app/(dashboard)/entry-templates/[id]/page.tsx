'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { entryTemplatesApi } from '@/lib/api/entry-templates';
import type { EntryTemplate } from '@/lib/api/entry-templates';
import { ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { EntryTemplateForm } from '@/components/entry-templates/entry-template-form';
import type { EntryTemplateFormValues } from '@/components/entry-templates/entry-template-form';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function mapTemplateToFormValues(template: EntryTemplate): EntryTemplateFormValues {
  return {
    name: template.name,
    description: template.description ?? '',
    blocks: template.blocks,
    translations: template.translations ?? {},
  };
}

export default function EditEntryTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') router.replace('/dashboard');
  }, [currentUser, router]);

  const { data: template, isLoading, error } = useQuery({
    queryKey: ['entry-templates', id],
    queryFn: () => entryTemplatesApi.getById(id),
  });

  const updateMutation = useMutation({
    mutationFn: (values: EntryTemplateFormValues) =>
      entryTemplatesApi.update(id, {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        blocks: values.blocks,
        translations: values.translations,
      }),
    onSuccess: () => {
      toast.success('Template saved');
      queryClient.invalidateQueries({ queryKey: ['entry-templates', id] });
      queryClient.invalidateQueries({ queryKey: ['entry-templates'] });
    },
    onError: () => toast.error('Failed to save template'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => entryTemplatesApi.delete(id),
    onSuccess: () => {
      toast.success('Template deleted');
      queryClient.invalidateQueries({ queryKey: ['entry-templates'] });
      router.push('/entry-templates');
    },
    onError: () => {
      setDeleteDialogOpen(false);
      toast.error('Failed to delete template');
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="rounded-xl border border-slate-200 p-5 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
            <div className="rounded-xl border border-slate-200 p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          </div>
          <div className="w-[320px] space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600 text-lg">Template not found</p>
        <Button variant="outline" asChild>
          <Link href="/entry-templates">
            <ArrowLeft size={16} aria-hidden="true" className="mr-1.5" />
            Back to Entry Templates
          </Link>
        </Button>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <p className="text-slate-600">Failed to load template.</p>
        <Button variant="outline" asChild>
          <Link href="/entry-templates">
            <ArrowLeft size={16} aria-hidden="true" className="mr-1.5" />
            Back to Entry Templates
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <EntryTemplateForm
          defaultValues={mapTemplateToFormValues(template)}
          isSubmitting={updateMutation.isPending}
          onSubmit={(values) => updateMutation.mutate(values)}
          onCancel={() => router.push('/entry-templates')}
          onDelete={() => setDeleteDialogOpen(true)}
          title={template.name}
        />
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Template"
        description={`Are you sure you want to delete "${template.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
