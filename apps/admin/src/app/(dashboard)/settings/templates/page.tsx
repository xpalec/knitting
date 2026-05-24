'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from 'lucide-react';

import { templatesApi } from '@/lib/api/templates';
import type { BlockTemplate } from '@/lib/api/templates';
import { TemplateEditorSheet } from '@/components/settings/template-editor-sheet';
import { useAuthStore } from '@/store/auth';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
// Skeleton rows
// ---------------------------------------------------------------------------

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-12" /></TableCell>
          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
          <TableCell><Skeleton className="h-8 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TemplatesPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editTarget, setEditTarget] = useState<BlockTemplate | null>(null);

  // Role guard — redirect non-admin users
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const { data: templates, isLoading, isError, refetch } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.listTemplates(),
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-800">Block Templates</h1>
      </div>

      {/* Error state */}
      {isError && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-slate-600">Failed to load templates.</p>
            <Button onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isError && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry Type</TableHead>
                  <TableHead>Block Count</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <SkeletonRows />
                ) : !isLoading && templates?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <Settings size={36} className="mb-3" aria-hidden="true" />
                        <p className="text-sm">No templates found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  templates?.map((template) => (
                    <TableRow
                      key={template.entry_type}
                      className="cursor-pointer"
                      onClick={() => setEditTarget(template)}
                    >
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {template.entry_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {template.block_count}
                      </TableCell>
                      <TableCell className="text-slate-500 whitespace-nowrap">
                        {formatDate(template.updated_at)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditTarget(template)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Template editor sheet */}
      <TemplateEditorSheet
        template={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['templates'] })}
      />
    </div>
  );
}
