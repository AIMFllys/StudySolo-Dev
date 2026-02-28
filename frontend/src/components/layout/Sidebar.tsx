'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { logout } from '@/services/auth.service';

export interface WorkflowMeta {
  id: string;
  name: string;
  updated_at: string;
  isRunning?: boolean;
}

interface SidebarProps {
  workflows: WorkflowMeta[];
}

export default function Sidebar({ workflows }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    workflowId: string;
  } | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, workflowId: id });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  return (
    <>
      <aside
        className="
          flex flex-col h-full shrink-0 transition-all duration-200
          bg-[#020617] border-r border-white/[0.08]
          w-16 lg:w-[280px]
        "
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-white/[0.08]">
          {/* Icon always visible */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="shrink-0 text-primary"
          >
            <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 7h8M6 10h5M6 13h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="hidden lg:block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            工作流
          </span>
        </div>

        {/* Workflow list */}
        <nav className="flex-1 overflow-y-auto py-2 scrollbar-hide">
          {workflows.length === 0 && (
            <p className="hidden lg:block px-4 py-3 text-xs text-muted-foreground">
              暂无工作流
            </p>
          )}
          {workflows.map((wf) => {
            const isActive = pathname === `/workspace/${wf.id}`;

            return (
              <Link
                key={wf.id}
                href={`/workspace/${wf.id}`}
                onContextMenu={(e) => handleContextMenu(e, wf.id)}
                className={`
                  relative flex items-center gap-3 mx-2 my-0.5 px-3 py-2.5
                  rounded-lg transition-all duration-200 group
                  ${
                    isActive
                      ? 'glass-active text-foreground'
                      : 'hover:bg-white/5 text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {/* Workflow icon + running indicator */}
                <span className="relative shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-current">
                    <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M4.5 5.5h7M4.5 8h5M4.5 10.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {wf.isRunning && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent animate-pulse" />
                  )}
                </span>

                {/* Text — only visible in expanded mode */}
                <div className="hidden lg:block flex-1 min-w-0">
                  <p className="text-sm truncate leading-tight">{wf.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {formatDate(wf.updated_at)}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section — settings & logout */}
        <div className="border-t border-white/[0.08] p-2 space-y-0.5">
          {/* Settings */}
          <Link
            href="/settings"
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
              ${
                pathname === '/settings'
                  ? 'bg-white/5 text-foreground'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }
            `}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
              <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M3.87 3.87l1.06 1.06M13.07 13.07l1.06 1.06M3.87 14.13l1.06-1.06M13.07 4.93l1.06-1.06"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden lg:block text-sm">设置</span>
          </Link>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors
              text-muted-foreground hover:bg-white/5 hover:text-foreground
            "
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
              <path
                d="M6.75 15.75H3.75a1.5 1.5 0 01-1.5-1.5V3.75a1.5 1.5 0 011.5-1.5h3M12 12.75L15.75 9 12 5.25M6.75 9h9"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden lg:block text-sm">退出登录</span>
          </button>
        </div>
      </aside>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 w-40 rounded-lg border border-white/[0.08] bg-[#0F172A] shadow-lg py-1 text-sm"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="w-full text-left px-3 py-2 text-foreground hover:bg-white/5 transition-colors"
              onClick={closeContextMenu}
            >
              重命名
            </button>
            <button
              className="w-full text-left px-3 py-2 text-destructive hover:bg-white/5 transition-colors"
              onClick={closeContextMenu}
            >
              删除
            </button>
          </div>
        </>
      )}
    </>
  );
}
