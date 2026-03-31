'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAdminSidebarNavigation } from '@/features/admin/hooks/use-admin-sidebar-navigation';
import { useAdminLogoutAction } from '@/features/admin/hooks/use-admin-logout-action';
import { useAdminStore } from '@/stores/use-admin-store';

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
];

const GROUP_LABELS: Record<string, string> = { main: '管理', data: '数据', system: '系统' };
const GROUPS = ['main', 'data', 'system'];

export function AdminSidebar() {
  const { sidebarOpen, isActive, closeSidebarOnMobileNavigate, toggleSidebar } =
    useAdminSidebarNavigation();
  const { logout, loggingOut } = useAdminLogoutAction();
  const admin = useAdminStore((state) => state.admin);
  const [expanded, setExpanded] = useState(false);
  const adminLabel = admin?.username ?? '管理员';

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={closeSidebarOnMobileNavigate} />
      )}
      <button
        onClick={toggleSidebar}
        className="fixed left-3 top-3 z-50 flex h-8 w-8 items-center justify-center rounded bg-[#232323] text-[#8f8f8f] md:hidden"
        aria-label="Toggle nav"
      >
        <span className="material-symbols-outlined text-[18px]">{sidebarOpen ? 'close' : 'menu'}</span>
      </button>

      <motion.aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        animate={{ width: expanded ? 220 : 48 }}
        transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
        className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-hidden border-r border-[#2e2e2e] bg-[#171717] transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-11 shrink-0 items-center gap-2.5 overflow-hidden border-b border-[#2e2e2e] px-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#3ecf8e] text-[9px] font-black text-[#171717]">
            SS
          </div>
          <motion.span
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.1, delay: expanded ? 0.05 : 0 }}
            className="whitespace-nowrap text-[13px] font-semibold text-[#ededed] tracking-tight"
          >
            StudySolo
          </motion.span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-1.5">
          {GROUPS.map((groupKey, gi) => {
            const items = ADMIN_NAV_ITEMS.filter((i) => i.group === groupKey);
            return (
              <div key={groupKey}>
                {gi > 0 && <div className="mx-2 my-2 h-px bg-[#2e2e2e]" />}
                <motion.div
                  animate={{ opacity: expanded ? 1 : 0, height: expanded ? 22 : 0 }}
                  transition={{ duration: 0.1 }}
                  className="overflow-hidden px-2.5"
                >
                  <span className="text-[10px] font-medium uppercase tracking-widest text-[#555]">
                    {GROUP_LABELS[groupKey]}
                  </span>
                </motion.div>
                <div className="flex flex-col gap-px">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeSidebarOnMobileNavigate}
                        className={`group relative flex h-8 items-center gap-2.5 overflow-hidden rounded px-2.5 transition-colors duration-75 ${
                          active
                            ? 'bg-[#232323] text-[#ededed]'
                            : 'text-[#8f8f8f] hover:bg-[#1f1f1f] hover:text-[#ededed]'
                        }`}
                      >
                        {active && (
                          <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-[#3ecf8e]" />
                        )}
                        <span className={`material-symbols-outlined shrink-0 text-[18px] ${active ? 'text-[#3ecf8e]' : ''}`}>
                          {item.icon}
                        </span>
                        <motion.span
                          animate={{ opacity: expanded ? 1 : 0 }}
                          transition={{ duration: 0.08, delay: expanded ? 0.04 : 0 }}
                          className="whitespace-nowrap text-[13px] font-medium"
                        >
                          {item.label}
                        </motion.span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="shrink-0 border-t border-[#2e2e2e] px-1.5 py-2 space-y-px">
          <div className="flex h-8 items-center gap-2.5 overflow-hidden rounded px-2.5">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#2e2e2e] text-[9px] font-bold text-[#8f8f8f]">
              {adminLabel.slice(0, 2).toUpperCase()}
            </div>
            <motion.span
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.08, delay: expanded ? 0.04 : 0 }}
              className="whitespace-nowrap text-[12px] font-medium text-[#666]"
            >
              {adminLabel}
            </motion.span>
          </div>
          <button
            onClick={() => void logout()}
            disabled={loggingOut}
            className="flex h-8 w-full items-center gap-2.5 overflow-hidden rounded px-2.5 text-[#555] transition-colors hover:bg-[#1f1f1f] hover:text-red-400 disabled:opacity-50"
          >
            <span className="material-symbols-outlined shrink-0 text-[18px]">logout</span>
            <motion.span
              animate={{ opacity: expanded ? 1 : 0 }}
              transition={{ duration: 0.08, delay: expanded ? 0.04 : 0 }}
              className="whitespace-nowrap text-[12px] font-medium"
            >
              {loggingOut ? '退出中...' : '退出登录'}
            </motion.span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
