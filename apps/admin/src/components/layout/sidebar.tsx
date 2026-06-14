'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Image,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Tag,
  Tags,
  Video,
  Calendar,
  Map,
  CaseSensitive,
  Layers,
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
    label: 'ENCYCLOPEDIA',
    items: [
      { label: 'Entries', href: '/entries', icon: BookOpen },
      { label: 'Entry templates', href: '/entry-templates', icon: Layers, adminOnly: true },
      { label: 'Abbreviations', href: '/abbreviations', icon: CaseSensitive },
      { label: 'Categories', href: '/categories', icon: Tag },
      { label: 'Tags', href: '/tags', icon: Tags },
    ],
  },
  {
    label: 'CONTENT',
    items: [
      { label: 'Articles', href: '/articles', icon: FileText },
      { label: 'Video', href: '/video', icon: Video },
    ],
  },
  {
    label: 'OTHER',
    items: [
      { label: 'Calendar', href: '/calendar', icon: Calendar },
      { label: 'Map', href: '/map', icon: Map },
    ],
  },
  {
    label: 'MEDIA',
    items: [
      { label: 'Media library', href: '/media', icon: Image },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: 'Users', href: '/users', icon: Users, adminOnly: true },
      { label: 'Settings', href: '/settings/languages', icon: Settings, adminOnly: true },
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
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <span className="text-white text-sm font-bold">K</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-slate-800 text-sm">Knitovia</span>
          )}
        </div>

        {/* Dashboard link (standalone, above sections) */}
        <div className="px-2 pt-4 pb-2">
          {(() => {
            const isActive = pathname === '/dashboard';
            const linkContent = (
              <Link
                href="/dashboard"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  collapsed && 'justify-center px-0 w-10 h-10 mx-auto',
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <LayoutDashboard
                  className={cn('shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')}
                  size={18}
                  aria-hidden="true"
                />
                {!collapsed && 'Dashboard'}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent side="right">Dashboard</TooltipContent>
                </Tooltip>
              );
            }
            return linkContent;
          })()}
        </div>

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-5 transition-colors">
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
                    const isActive = pathname.startsWith(item.href);
                    const Icon = item.icon;

                    const linkContent = (
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-violet-50 text-violet-700'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                          collapsed && 'justify-center px-0 w-10 h-10 mx-auto',
                        )}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <Icon
                          className={cn('shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')}
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
