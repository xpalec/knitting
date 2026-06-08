'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { entryTemplatesApi } from '@/lib/api/entry-templates';
import { contentBlockTypesApi } from '@/lib/api/content-block-types';
import { useAuthStore } from '@/store/auth';
import { EntryTemplateForm } from '@/components/entry-templates/entry-template-form';
import type { EntryTemplateFormValues } from '@/components/entry-templates/entry-template-form';

export default function NewEntryTemplatePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  // Role guard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const { data: blockTypes, isLoading: isLoadingBlockTypes } = useQuery({
    queryKey: ['content-block-types'],
    queryFn: () => contentBlockTypesApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (values: EntryTemplateFormValues) =>
      entryTemplatesApi.create({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        blocks: values.blocks,
      }),
    onSuccess: (template) => {
      toast.success('Template created');
      router.push(`/entry-templates/${template.id}`);
    },
    onError: () => {
      toast.error('Failed to create template');
    },
  });

  return (
    <div className="p-6">
      <EntryTemplateForm
        blockTypes={blockTypes}
        isLoadingBlockTypes={isLoadingBlockTypes}
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
        onCancel={() => router.push('/entry-templates')}
        title="Create New Template"
      />
    </div>
  );
}
