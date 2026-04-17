'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, GitBranch, Plus, Loader2, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MobileNavProps {
  onNewWorkflow?: () => Promise<void> | void;
  creating?: boolean;
}

export default function MobileNav({ onNewWorkflow, creating = false }: MobileNavProps) {
  const pathname = usePathname();

  const navItems: { href: string; icon: LucideIcon; label: string; isActive: boolean }[] = [
    {
      href: '/workspace',
      icon: LayoutDashboard,
      label: '首页',
      isActive: pathname === '/workspace',
    },
    {
      href: '/workspace',
      icon: GitBranch,
      label: '工作流',
      isActive: pathname?.startsWith('/c/') ?? false,
    },
    {
      href: '/settings',
      icon: Settings,
      label: '设置',
      isActive: pathname === '/settings',
    },
  ];

  // Find active index for indicator animation
  const activeIndex = navItems.findIndex((item) => item.isActive);
  const indicatorPosition = activeIndex >= 0 ? activeIndex : -1;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-panel flex items-center justify-around h-16 px-2 md:hidden safe-area-bottom"
      role="navigation"
      aria-label="移动端导航"
    >
      {/* Active indicator background */}
      <div
        className="absolute bottom-2 h-12 w-16 rounded-2xl bg-primary/10 transition-all duration-300 ease-out"
        style={{
          left: indicatorPosition >= 0 ? `${indicatorPosition * 25 + 8}%` : '-100%',
          transform: 'translateX(-50%)',
          opacity: indicatorPosition >= 0 ? 1 : 0,
        }}
      />

      {navItems.slice(0, 2).map((item, index) => (
        <Link
          key={item.label}
          href={item.href}
          className={`relative flex flex-col items-center justify-center gap-1 min-w-[3.5rem] py-2 rounded-xl transition-all duration-200 active:scale-95 ${
            item.isActive
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5'
          }`}
          aria-label={item.label}
          aria-current={item.isActive ? 'page' : undefined}
        >
          <item.icon className={`w-5 h-5 transition-transform duration-200 ${item.isActive ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          {item.isActive && (
            <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />
          )}
        </Link>
      ))}

      <button
        onClick={() => void onNewWorkflow?.()}
        disabled={creating}
        className="relative flex flex-col items-center justify-center gap-1 min-w-[3.5rem] py-2 rounded-xl transition-all duration-200 group disabled:opacity-50 active:scale-95"
        aria-label="新建工作流"
      >
        <span className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-glow group-hover:opacity-90 transition-all">
          {creating
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Plus className="w-5 h-5" />
          }
        </span>
        <span className="text-[10px] font-medium leading-tight text-primary">
          {creating ? '创建中' : '新建'}
        </span>
      </button>

      {navItems.slice(2).map((item, index) => (
        <Link
          key={item.label}
          href={item.href}
          className={`relative flex flex-col items-center justify-center gap-1 min-w-[3.5rem] py-2 rounded-xl transition-all duration-200 active:scale-95 ${
            item.isActive
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5'
          }`}
          aria-label={item.label}
          aria-current={item.isActive ? 'page' : undefined}
        >
          <item.icon className={`w-5 h-5 transition-transform duration-200 ${item.isActive ? 'scale-110' : ''}`} />
          <span className="text-[10px] font-medium leading-tight">{item.label}</span>
          {item.isActive && (
            <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary" />
          )}
        </Link>
      ))}
    </nav>
  );
}
