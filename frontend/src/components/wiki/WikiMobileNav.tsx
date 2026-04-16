'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/wiki';
import WikiSidebarClient from './WikiSidebarClient';

interface WikiMobileNavProps {
  navItems: NavItem[];
}

export default function WikiMobileNav({ navItems }: WikiMobileNavProps) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  return (
    <>
      <div className="wiki-mobile-header">
        <Link href="/wiki" className="wiki-mobile-brand">
          <BookOpen className="h-4 w-4" />
          <span>文档中心</span>
        </Link>
        <button
          type="button"
          aria-label={open ? '关闭导航' : '打开导航'}
          aria-expanded={open}
          className="wiki-mobile-button"
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="wiki-mobile-panel">
          <WikiSidebarClient navItems={navItems} />
        </div>
      )}
    </>
  );
}
