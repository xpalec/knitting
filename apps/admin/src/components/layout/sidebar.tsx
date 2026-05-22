'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  InboxIcon,
  FileText,
  Image,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_SECTIONS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'CONTENT',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Entries', href: '/entries', icon: BookOpen },
      { label: 'Queue', href: '/queue', icon: InboxIcon },
      { label: 'Articles', href: '/articles', icon: FileText },
    ],
  },
  {
    label: 'MEDIA',
    items: [
      { label: 'Media Library', href: '/media', icon: Image },
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      { label: 'Block Templates', href: '/settings/templates', icon: Settings, adminOnly: true },
      { label: 'Users', href: '/users', icon: Users, adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = currentUser?.role === 'admin';

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'relative flex flex-col bg-white border-r border-slate-200 transition-all duration-200 shrink-0',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Logo */}
        <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-slate-100', collapsed && 'justify-center px-0')}>
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">K</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-slate-800 text-sm">Knitting Admin</span>
          )}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.adminOnly || isAdmin,
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.label}>
                {!collapsed && (
                  <p className="px-2 mb-1 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    {section.label}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isActive =
                      item.href === '/dashboard'
                        ? pathname === '/dashboard'
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                          collapsed && 'justify-center px-0 w-10 h-10 mx-auto',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon
                          className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-slate-400')}
                          size={18}
                          aria-hidden="true"
                        />
                        {!collapsed && item.label}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <li key={item.href}>
                          <Tooltip>
                            <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                            <TooltipContent side="right">{item.label}</TooltipContent>
                          </Tooltip>
                        </li>
                      );
                    }

                    return <li key={item.href}>{linkContent}</li>;
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight size={12} className="text-slate-500" />
          ) : (
            <ChevronLeft size={12} className="text-slate-500" />
          )}
        </button>
      </aside>
    </TooltipProvider>
  );
}
