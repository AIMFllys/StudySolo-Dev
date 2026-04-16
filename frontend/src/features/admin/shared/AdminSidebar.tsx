'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAdminSidebarNavigation } from '@/features/admin/hooks/use-admin-sidebar-navigation';
import { useAdminLogoutAction } from '@/features/admin/hooks/use-admin-logout-action';
import { useAdminStore } from '@/stores/admin/use-admin-store';

export const ADMIN_NAV_ITEMS = [
  { href: '/admin-analysis', label: '概览', icon: 'space_dashboard', group: 'main' },
  { href: '/admin-analysis/users', label: '用户管理', icon: 'group', group: 'main' },
  { href: '/admin-analysis/workflows', label: '工作流', icon: 'account_tree', group: 'main' },
  { href: '/admin-analysis/members', label: '会员', icon: 'workspace_premium', group: 'main' },
  { href: '/admin-analysis/ratings', label: '用户反馈', icon: 'rate_review', group: 'data' },
  { href: '/admin-analysis/notices', label: '公告管理', icon: 'campaign', group: 'data' },
  { href: '/admin-analysis/models', label: '模型配置', icon: 'neurology', group: 'system' },
  { href: '/admin-analysis/audit', label: '审计日志', icon: 'shield_person', group: 'system' },
  { href: '/admin-analysis/config', label: '系统设置', icon: 'tune', group: 'system' },
  { href: '/admin-analysis/diagnostics', label: '系统诊断', icon: 'stethoscope', group: 'system' },
];

const GROUP_LABELS: Record<string, string> = { main: '管理', data: '数据', system: '系统' };
const GROUPS = ['main', 'data', 'system'];

const STORAGE_KEY = 'admin-sidebar-pinned';

/** Supabase-style sidebar: icon-only by default, click pin to expand */
export function AdminSidebar() {
  const { sidebarOpen, isActive, closeSidebarOnMobileNavigate, toggleSidebar } =
    useAdminSidebarNavigation();
  const { logout, loggingOut } = useAdminLogoutAction();
  const admin = useAdminStore((state) => state.admin);
  const adminLabel = admin?.username ?? '管理员';

  // Pinned = expanded (persisted); unpinned = icon-only
  // 默认展开，读取缓存若为 'false' 则收起
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  });

  const togglePin = () => {
    setPinned((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const expanded = pinned;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeSidebarOnMobileNavigate}
        />
      )}

      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="fixed left-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground md:hidden"
        aria-label="Toggle nav"
      >
        <span className="material-symbols-outlined text-[18px]">
          {sidebarOpen ? 'close' : 'menu'}
        </span>
      </button>

      {/* Sidebar */}
      <aside
        style={{ width: expanded ? 220 : 52 }}
        className={[
          'flex shrink-0 flex-col border-r border-border bg-card',
          'overflow-hidden transition-[width] duration-200 ease-in-out',
          // Mobile: off-canvas when closed, fixed when open
          'fixed inset-y-0 left-0 z-40 md:static',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* ── Logo row + pin toggle ── */}
        <div className="flex h-11 shrink-0 items-center border-b border-border">
          {/* Logo area */}
          <div className="flex flex-1 items-center gap-2 overflow-hidden pl-[14px]">
            <Image
              src="/StudySolo.png"
              alt="StudySolo"
              width={20}
              height={20}
              className="shrink-0 rounded"
            />
            <span
              className={[
                'whitespace-nowrap text-[13px] font-semibold text-foreground tracking-tight',
                'transition-[opacity,max-width] duration-150',
                expanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0',
              ].join(' ')}
            >
              StudySolo
            </span>
          </div>

          {/* Pin button */}
          <button
            onClick={togglePin}
            title={expanded ? '收起侧边栏' : '展开侧边栏'}
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
          >
            <span className="material-symbols-outlined text-[16px]">
              {expanded ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
        </div>

        {/* ── Nav items ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-[6px]">
          {GROUPS.map((groupKey, gi) => {
            const items = ADMIN_NAV_ITEMS.filter((i) => i.group === groupKey);
            return (
              <div key={groupKey}>
                {gi > 0 && <div className="mx-2 my-1.5 h-px bg-border" />}

                {/* Group label — only visible when expanded */}
                <div
                  className={[
                    'h-6 overflow-hidden px-2 transition-[opacity,height] duration-150',
                    expanded ? 'opacity-100' : 'h-0 opacity-0',
                  ].join(' ')}
                >
                  <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    {GROUP_LABELS[groupKey]}
                  </span>
                </div>

                {/* Nav links */}
                <div className="flex flex-col gap-px">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeSidebarOnMobileNavigate}
                        title={expanded ? undefined : item.label}
                        className={[
                          'group relative flex h-8 shrink-0 items-center gap-2.5 rounded-md transition-colors duration-75',
                          expanded ? 'px-2' : 'justify-center px-0',
                          active
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                        ].join(' ')}
                      >
                        {/* Active indicator */}
                        {active && (
                          <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary" />
                        )}

                        {/* Icon */}
                        <span
                          className={[
                            'material-symbols-outlined shrink-0 text-[17px]',
                            active ? 'text-primary' : '',
                          ].join(' ')}
                        >
                          {item.icon}
                        </span>

                        {/* Label */}
                        <span
                          className={[
                            'whitespace-nowrap text-[13px] font-medium',
                            'transition-[opacity,max-width] duration-150',
                            expanded ? 'max-w-[160px] opacity-100' : 'max-w-0 opacity-0',
                          ].join(' ')}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Bottom: user + logout ── */}
        <div className="shrink-0 border-t border-border px-[6px] py-2 space-y-px">
          {/* User row */}
          <div
            className={[
              'flex h-8 items-center gap-2.5 rounded-md',
              expanded ? 'px-2' : 'justify-center',
            ].join(' ')}
            title={expanded ? undefined : adminLabel}
          >
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-secondary text-[9px] font-bold text-muted-foreground">
              {adminLabel.slice(0, 2).toUpperCase()}
            </div>
            <span
              className={[
                'whitespace-nowrap text-[12px] font-medium text-muted-foreground',
                'transition-[opacity,max-width] duration-150',
                expanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0',
              ].join(' ')}
            >
              {adminLabel}
            </span>
          </div>

          {/* Logout button */}
          <button
            onClick={() => void logout()}
            disabled={loggingOut}
            title={expanded ? undefined : '退出登录'}
            className={[
              'flex h-8 w-full items-center gap-2.5 rounded-md text-muted-foreground/60',
              'transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50',
              expanded ? 'px-2' : 'justify-center px-0',
            ].join(' ')}
          >
            <span className="material-symbols-outlined shrink-0 text-[17px]">logout</span>
            <span
              className={[
                'whitespace-nowrap text-[12px] font-medium',
                'transition-[opacity,max-width] duration-150',
                expanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0',
              ].join(' ')}
            >
              {loggingOut ? '退出中...' : '退出登录'}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
