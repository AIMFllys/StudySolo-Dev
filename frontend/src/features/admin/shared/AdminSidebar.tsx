'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdminSidebarNavigation } from '@/features/admin/hooks/use-admin-sidebar-navigation';
import { useAdminLogoutAction } from '@/features/admin/hooks/use-admin-logout-action';

export const ADMIN_NAV_ITEMS = [
  { href: '/admin-analysis', label: '概览', icon: 'space_dashboard', group: 'main' },
  { href: '/admin-analysis/users', label: '用户', icon: 'group', group: 'main' },
  { href: '/admin-analysis/workflows', label: '工作流', icon: 'account_tree', group: 'main' },
  { href: '/admin-analysis/members', label: '会员', icon: 'workspace_premium', group: 'main' },
  { href: '/admin-analysis/ratings', label: '反馈', icon: 'rate_review', group: 'data' },
  { href: '/admin-analysis/notices', label: '公告', icon: 'campaign', group: 'data' },
  { href: '/admin-analysis/models', label: '模型', icon: 'neurology', group: 'system' },
  { href: '/admin-analysis/audit', label: '审计', icon: 'shield_person', group: 'system' },
  { href: '/admin-analysis/config', label: '设置', icon: 'tune', group: 'system' },
];

const GROUPS = [
  { key: 'main', label: '核心' },
  { key: 'data', label: '数据' },
  { key: 'system', label: '系统' },
];

function NavTooltip({ label, visible }: { label: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: -4, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -4, scale: 0.96 }}
          transition={{ duration: 0.12 }}
          className="absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-lg"
        >
          {label}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AdminSidebar() {
  const { sidebarOpen, isActive, closeSidebarOnMobileNavigate, toggleSidebar } =
    useAdminSidebarNavigation();
  const { logout, loggingOut } = useAdminLogoutAction();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] md:hidden"
          onClick={closeSidebarOnMobileNavigate}
        />
      )}

      {/* Mobile hamburger */}
      <button
        onClick={toggleSidebar}
        className="fixed left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm transition-all hover:bg-white hover:text-slate-900 md:hidden"
        aria-label={sidebarOpen ? '关闭导航' : '打开导航'}
      >
        <span className="material-symbols-outlined text-[20px]">{sidebarOpen ? 'close' : 'menu'}</span>
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[68px] flex-col items-center border-r border-slate-200/60 bg-white/70 backdrop-blur-md transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 w-full items-center justify-center border-b border-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-[11px] font-black tracking-tight text-white">
            SS
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-4 px-2 w-full">
          {GROUPS.map((group, gi) => {
            const groupItems = ADMIN_NAV_ITEMS.filter((i) => i.group === group.key);
            return (
              <div key={group.key} className="w-full">
                {gi > 0 && <div className="mx-auto my-2 h-px w-8 bg-slate-200/80" />}
                <div className="flex flex-col items-center gap-1 w-full">
                  {groupItems.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <div
                        key={item.href}
                        className="relative w-full flex justify-center"
                        onMouseEnter={() => setHoveredItem(item.href)}
                        onMouseLeave={() => setHoveredItem(null)}
                      >
                        <Link
                          href={item.href}
                          onClick={closeSidebarOnMobileNavigate}
                          className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
                            active
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                          }`}
                          aria-label={item.label}
                        >
                          <span className={`material-symbols-outlined text-[20px] ${active ? 'font-medium' : ''}`}>
                            {item.icon}
                          </span>
                        </Link>
                        <NavTooltip label={item.label} visible={hoveredItem === item.href} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom: logout */}
        <div className="flex flex-col items-center gap-2 border-t border-slate-100 py-4 px-2 w-full">
          <div
            className="relative w-full flex justify-center"
            onMouseEnter={() => setHoveredItem('logout')}
            onMouseLeave={() => setHoveredItem(null)}
          >
            <button
              onClick={() => void logout()}
              disabled={loggingOut}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
              aria-label="退出登录"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
            </button>
            <NavTooltip label={loggingOut ? '退出中...' : '退出登录'} visible={hoveredItem === 'logout'} />
          </div>
        </div>
      </aside>
    </>
  );
}
