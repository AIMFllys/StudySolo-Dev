'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface MobileNavProps {
  onNewWorkflow?: () => void;
}

export default function MobileNav({ onNewWorkflow }: MobileNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      href: '/dashboard',
      icon: 'dashboard',
      label: '首页',
      isActive: pathname === '/dashboard' || pathname === '/',
    },
    {
      href: '/workspace',
      icon: 'account_tree',
      label: '工作流',
      isActive: pathname?.startsWith('/workspace'),
    },
    {
      href: '/settings',
      icon: 'settings',
      label: '设置',
      isActive: pathname === '/settings',
    },
  ];

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0 z-50
        glass-panel
        flex items-center justify-around
        h-16 px-2
        md:hidden
      "
      role="navigation"
      aria-label="移动端导航"
    >
      {/* First two nav items */}
      {navItems.slice(0, 2).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1 transition-colors ${
            item.isActive
              ? 'text-primary'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          aria-label={item.label}
          aria-current={item.isActive ? 'page' : undefined}
        >
          <span className="material-symbols-outlined text-xl leading-none">
            {item.icon}
          </span>
          <span className="text-[10px] font-medium leading-tight">
            {item.label}
          </span>
        </Link>
      ))}

      {/* Center: New workflow CTA */}
      <button
        onClick={onNewWorkflow}
        className="flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1 transition-colors group"
        aria-label="新建工作流"
      >
        <span className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-glow group-hover:opacity-90 group-active:scale-[0.95] transition-all">
          <span className="material-symbols-outlined text-xl leading-none">
            add
          </span>
        </span>
        <span className="text-[10px] font-medium leading-tight text-primary">
          新建
        </span>
      </button>

      {/* Last nav item (Settings) */}
      {navItems.slice(2).map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center justify-center gap-0.5 min-w-[3rem] py-1 transition-colors ${
            item.isActive
              ? 'text-primary'
              : 'text-[#94A3B8] hover:text-[#F8FAFC]'
          }`}
          aria-label={item.label}
          aria-current={item.isActive ? 'page' : undefined}
        >
          <span className="material-symbols-outlined text-xl leading-none">
            {item.icon}
          </span>
          <span className="text-[10px] font-medium leading-tight">
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
