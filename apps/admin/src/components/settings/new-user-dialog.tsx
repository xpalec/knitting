'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi, type UserRole } from '@/lib/api/users';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface NewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function resetState() {
  return {
    name: '',
    email: '',
    password: '',
    role: 'reviewer' as UserRole,
    errors: {} as Record<string, string>,
  };
}

export function NewUserDialog({ open, onOpenChange, onCreated }: NewUserDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('reviewer');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset all fields whenever the dialog closes
  useEffect(() => {
    if (!open) {
      const s = resetState();
      setName(s.name);
      setEmail(s.email);
      setPassword(s.password);
      setRole(s.role);
      setErrors(s.errors);
    }
  }, [open]);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      usersApi.createUser({ name: name || undefined, email, password, role }),
    onSuccess: () => {
      toast.success('User created');
      onCreated();
      onOpenChange(false);
      // reset is handled by the onOpenChange effect above
    },
    onError: () => toast.error('Failed to create user'),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    // Email validation: required + must contain @ with non-empty local and domain parts
    const atIndex = email.indexOf('@');
    const localPart = atIndex > 0 ? email.slice(0, atIndex) : '';
    const domainPart = atIndex > 0 ? email.slice(atIndex + 1) : '';
    if (!email || atIndex < 1 || !localPart || !domainPart) {
      newErrors.email = 'Valid email is required.';
    }

    // Password validation: required + length >= 8
    if (!password || password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    mutate();
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="new-user-name">
              Name <span className="text-slate-400">(optional)</span>
            </Label>
            <Input
              id="new-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>

          {/* Email (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">Email</Label>
            <Input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Password (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">Password</Label>
            <Input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Role (required) */}
          <div className="space-y-1.5">
            <Label htmlFor="new-user-role">Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="new-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="reviewer">Reviewer</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
              {isPending ? 'Creating…' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
