'use client';

import { useRouter } from 'next/navigation';
import { Bell, LogOut, User } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/store/auth';
import { usePageHeader } from '@/providers/page-header-provider';
import { apiPost } from '@/lib/api/client';
import { toast } from 'sonner';

export function Topbar() {
  const router = useRouter();
  const { currentUser, clearUser } = useAuthStore();
  const { header } = usePageHeader();

  async function handleLogout() {
    try {
      await apiPost('/api/v1/auth/logout');
    } catch {
      // ignore — clear local state regardless
    }
    // Clear the local session cookie
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    clearUser();
    router.push('/login');
    toast.success('Signed out');
  }

  const initials = currentUser?.email
    ? currentUser.email.slice(0, 2).toUpperCase()
    : '??';

  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-6 shrink-0 min-h-[64px]">
      {/* Page title + description */}
      <div className="flex-1 min-w-0 py-3">
        {header.title && (
          <>
            <h1 className="text-xl font-semibold text-slate-800 leading-tight">
              {header.title}
            </h1>
            {header.description && (
              <p className="text-xs text-slate-500 mt-0.5">{header.description}</p>
            )}
          </>
        )}
      </div>

      {/* Page action buttons */}
      {/* Actions are now rendered in the page body — not in the topbar */}

      {/* Right-side chrome: notification bell + user menu */}
      <div className="flex items-center gap-3 shrink-0 pl-3 border-l border-slate-100">
        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-slate-500 hover:text-slate-700"
          aria-label="Notifications"
        >
          <Bell size={18} aria-hidden="true" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-slate-100 transition-colors"
              aria-label="User menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-semibold bg-violet-600 text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {currentUser?.email && (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {currentUser.email}
                  </p>
                  {currentUser.role && (
                    <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
                  )}
                </div>
                <DropdownMenuSeparator />
              </>
            )}
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
