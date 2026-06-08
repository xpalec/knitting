'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { contentBlockTypesApi } from '@/lib/api/content-block-types';
import { ApiError } from '@/lib/api/client';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const createBlockTypeSchema = z.object({
  type: z
    .string()
    .min(1, 'Type slug is required')
    .max(50, 'Type slug must be at most 50 characters')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Must start with a lowercase letter, followed by lowercase letters, digits, or underscores',
    ),
  label: z
    .string()
    .min(1, 'Label is required')
    .max(255, 'Label must be at most 255 characters'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters')
    .optional()
    .or(z.literal('')),
});

type CreateBlockTypeFormValues = z.infer<typeof createBlockTypeSchema>;

interface CreateBlockTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateBlockTypeDialog({
  open,
  onOpenChange,
}: CreateBlockTypeDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateBlockTypeFormValues>({
    resolver: zodResolver(createBlockTypeSchema),
    defaultValues: {
      type: '',
      label: '',
      description: '',
    },
  });

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const { mutate, isPending } = useMutation({
    mutationFn: (values: CreateBlockTypeFormValues) =>
      contentBlockTypesApi.create({
        type: values.type,
        label: values.label,
        description: values.description || undefined,
      }),
    onSuccess: () => {
      toast.success('Block type created');
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ['content-block-types'] });
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.status === 409) {
        form.setError('type', {
          message: 'A block type with this slug already exists',
        });
      } else {
        toast.error('Failed to create block type');
      }
    },
  });

  function onSubmit(values: CreateBlockTypeFormValues) {
    mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Block Type</DialogTitle>
          <DialogDescription>
            Create a new content block type for use in entry templates.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. rich_text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Rich Text"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description{' '}
                    <span className="text-muted-foreground font-normal">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of this block type"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
