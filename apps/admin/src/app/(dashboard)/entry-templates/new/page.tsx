'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { entryTemplatesApi } from '@/lib/api/entry-templates';
import { useAuthStore } from '@/store/auth';
import { EntryTemplateForm } from '@/components/entry-templates/entry-template-form';
import type { EntryTemplateFormValues } from '@/components/entry-templates/entry-template-form';

export default function NewEntryTemplatePage() {
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') router.replace('/dashboard');
  }, [currentUser, router]);

  const createMutation = useMutation({
    mutationFn: (values: EntryTemplateFormValues) =>
      entryTemplatesApi.create({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        blocks: values.blocks,
        translations: values.translations,
      }),
    onSuccess: (template) => {
      toast.success('Template created');
      router.push(`/entry-templates/${template.id}`);
    },
    onError: () => toast.error('Failed to create template'),
  });

  return (
    <div className="p-6">
      <EntryTemplateForm
        isSubmitting={createMutation.isPending}
        onSubmit={(values) => createMutation.mutate(values)}
        onCancel={() => router.push('/entry-templates')}
        title="Create New Template"
      />
    </div>
  );
}
