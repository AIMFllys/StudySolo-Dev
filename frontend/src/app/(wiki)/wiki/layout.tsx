/**
 * Wiki 专属布局 — 独立于主应用 DashboardShell。
 * 左侧：文档导航；右侧：内容区。
 */

import Link from 'next/link';
import WikiSidebar from '@/components/wiki/WikiSidebar';

export default function WikiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar nav */}
      <aside className="hidden w-56 shrink-0 border-r border-border md:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto px-4 py-6">
          <Link
            href="/wiki"
            className="mb-6 text-base font-semibold text-foreground hover:text-primary"
          >
            📖 文档中心
          </Link>

          <WikiSidebar />
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto px-6 py-8 md:px-12">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
