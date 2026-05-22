'use client';

import { useRouter } from 'next/navigation';
import { Search, LogOut, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth';
import { apiPost } from '@/lib/api/client';
import { toast } from 'sonner';

const ROLE_BADGE_VARIANT: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  editor: 'bg-blue-100 text-blue-700',
  reviewer: 'bg-slate-100 text-slate-600',
};

export function Topbar() {
  const router = useRouter();
  const { currentUser, clearUser } = useAuthStore();

  async function handleLogout() {
    try {
      await apiPost('/api/v1/auth/logout');
    } catch {
      // ignore -- clear local state regardless
    }
    clearUser();
    router.push('/login');
    toast.success('Signed out');
  }

  const initials = currentUser?.email
    ? currentUser.email.slice(0, 2).toUpperCase()
    : '??';

  const roleClass = currentUser?.role
    ? (ROLE_BADGE_VARIANT[currentUser.role] ?? ROLE_BADGE_VARIANT.reviewer)
    : ROLE_BADGE_VARIANT.reviewer;

  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 py-3 shrink-0">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
          aria-hidden="true"
        />
        <Input
          placeholder="Search entries..."
          className="pl-9 h-9 bg-slate-50 border-slate-200 text-sm"
          aria-label="Search entries"
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Role badge */}
        {currentUser?.role && (
          <span
            className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleClass}`}
          >
            {currentUser.role}
          </span>
        )}

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 transition-colors"
              aria-label="User menu"
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[140px] truncate">
                {currentUser?.email ?? 'User'}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="gap-2 text-slate-600" disabled>
              <User size={14} aria-hidden="true" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut size={14} aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
