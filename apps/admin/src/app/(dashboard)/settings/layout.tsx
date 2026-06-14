'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Globe, Layers } from 'lucide-react';

const SETTINGS_NAV = [
  { label: 'Languages', href: '/settings/languages', icon: Globe },
  { label: 'Block Templates', href: '/settings/templates', icon: Layers },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-6">
      {/* Settings sidebar nav */}
      <aside className="w-44 shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2">
          Settings
        </p>
        <nav>
          <ul className="space-y-0.5">
            {SETTINGS_NAV.map(({ label, href, icon: Icon }) => {
              const isActive = pathname.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-violet-50 text-violet-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      size={15}
                      className={cn('shrink-0', isActive ? 'text-violet-600' : 'text-slate-400')}
                      aria-hidden="true"
                    />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Page content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
