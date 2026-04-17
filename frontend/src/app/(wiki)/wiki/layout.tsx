/**
 * Wiki 专属布局 — 独立于主应用 DashboardShell。
 * 左侧：文档导航；右侧：内容区。
 */

import '@/styles/wiki.css';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import WikiSidebar from '@/components/wiki/WikiSidebar';
import WikiMobileNav from '@/components/wiki/WikiMobileNav';
import { getNavigation } from '@/lib/wiki';

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  const navItems = getNavigation();

  return (
    <div className="wiki-shell">
      <WikiMobileNav navItems={navItems} />
      {/* Sidebar nav */}
      <aside className="wiki-sidebar">
        <div className="wiki-sidebar-inner">
          <Link
            href="/wiki"
            className="wiki-brand"
          >
            <BookOpen className="h-4 w-4 text-blue-700" />
            <span>文档中心</span>
          </Link>

          <WikiSidebar navItems={navItems} />
        </div>
      </aside>

      {/* Content */}
      <main className="wiki-main">
        <div className="wiki-content">{children}</div>
      </main>
    </div>
  );
}
