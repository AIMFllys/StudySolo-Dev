'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Wrench, Bot, Library, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMobileAIStore } from '@/stores/use-mobile-ai-store';

interface MobileNavProps {
  onNewWorkflow?: () => Promise<void> | void;
  creating?: boolean;
}

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  isAction?: boolean;
  onClick?: () => void;
}

export default function MobileNav({ onNewWorkflow, creating = false }: MobileNavProps) {
  const pathname = usePathname();
  const { toggleOpen, isOpen } = useMobileAIStore();

  const navItems: NavItem[] = [
    {
      href: '/mobile-home',
      icon: Home,
      label: '首页',
      isActive: pathname === '/mobile-home',
    },
    {
      href: '/workspace',
      icon: Wrench,
      label: '节点',
      isActive: pathname === '/workspace' || pathname?.startsWith('/c/') || false,
    },
    {
      href: '#',
      icon: Bot,
      label: '智能体',
      isActive: isOpen,
      isAction: true,
      onClick: () => toggleOpen(),
    },
    {
      href: '/settings?tab=knowledge',
      icon: Library,
      label: '库集',
      isActive: pathname === '/settings' && typeof window !== 'undefined' && window.location.search.includes('tab=knowledge'),
    },
    {
      href: '/settings',
      icon: Settings,
      label: '设置',
      isActive: pathname === '/settings' && (typeof window === 'undefined' || !window.location.search.includes('tab=knowledge')),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 glass-panel flex items-center justify-around h-14 px-1 md:hidden safe-area-bottom"
      role="navigation"
      aria-label="移动端导航"
    >
      {navItems.map((item) => {
        const content = (
          <>
            <item.icon className={`w-5 h-5 transition-all duration-200 ${item.isActive ? 'scale-110 text-primary' : ''}`} />
            <span className={`text-[10px] font-medium leading-tight ${item.isActive ? 'text-primary' : ''}`}>
              {item.label}
            </span>
            {item.isActive && (
              <span className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary" />
            )}
          </>
        );

        const baseClasses = `relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-all duration-200 active:scale-95 ${
          item.isActive
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/5'
        }`;

        if (item.isAction && item.onClick) {
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={baseClasses}
              aria-label={item.label}
              aria-pressed={item.isActive}
            >
              {content}
            </button>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            className={baseClasses}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
