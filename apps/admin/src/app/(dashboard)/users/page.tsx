'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';

import { usersApi } from '@/lib/api/users';
import type { AdminUser, UserRole } from '@/lib/api/users';
import { NewUserDialog } from '@/components/settings/new-user-dialog';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/layout/page-header';
import { Pagination } from '@/components/ui/pagination';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  admin:    'bg-violet-200 text-violet-700',
  editor:   'bg-blue-200   text-blue-700',
  reviewer: 'bg-slate-200  text-slate-600',
};

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
          <TableCell><Skeleton className="h-4 w-36" /></TableCell>
          <TableCell><Skeleton className="h-4 w-48" /></TableCell>
          <TableCell><Skeleton className="h-5 w-28" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Role guard — redirect non-admin users
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [currentUser, router]);

  const [newUserOpen, setNewUserOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { page, limit: pageSize }],
    queryFn: () => usersApi.listUsers({ page, limit: pageSize }),
  });

  const users: AdminUser[] = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) =>
      usersApi.updateUserRole(id, role),
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to update role'),
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <PageHeader
        title="Users"
        description="Manage admin users and their roles"
      >
        <Button onClick={() => setNewUserOpen(true)} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus size={16} aria-hidden="true" />
          Add
        </Button>
      </PageHeader>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <SkeletonRows />
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Users size={36} className="mb-3" aria-hidden="true" />
                      <p className="text-sm">No users found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium text-slate-700">
                      {user.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">
                      {user.email}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) =>
                            updateRoleMutation.mutate({ id: user.id, role: newRole as UserRole })
                          }
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="reviewer">Reviewer</SelectItem>
                          </SelectContent>
                        </Select>
                        <span
                          className={cn(
                            'inline-flex items-center justify-center rounded-lg px-4 py-1 text-xs font-semibold capitalize min-w-[72px]',
                            ROLE_BADGE_STYLES[user.role],
                          )}
                        >
                          {user.role}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell>
                      {/* Placeholder — no delete action per spec */}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />

      {/* New User dialog */}
      <NewUserDialog
        open={newUserOpen}
        onOpenChange={setNewUserOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />
    </div>
  );
}
