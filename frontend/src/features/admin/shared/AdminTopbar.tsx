'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAdminStore } from '@/stores/use-admin-store';
import { ADMIN_NAV_ITEMS } from './AdminSidebar';

function resolvePageTitle(pathname: string): string {
  const match = ADMIN_NAV_ITEMS.find((item) => {
    if (item.href === '/admin-analysis') return pathname === '/admin-analysis';
    return pathname.startsWith(item.href);
  });
  return match?.label ?? '后台';
}

export function AdminTopbar() {
  const pathname = usePathname();
  const admin = useAdminStore((state) => state.admin);
  const pageTitle = useMemo(() => resolvePageTitle(pathname), [pathname]);
  const adminLabel = admin?.username ?? '管理员';

  return (
    <motion.header
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="sticky top-0 z-20 flex h-12 w-full items-center justify-between border-b border-slate-200/50 bg-white/60 px-6 backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight">{pageTitle}</h1>
        <span className="hidden text-[10px] font-medium text-slate-300 sm:inline">/</span>
        <span className="hidden text-[10px] font-medium tracking-wide text-slate-400 sm:inline">StudySolo Admin</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 ring-1 ring-emerald-200/60">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-700 tracking-wide">ONLINE</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[9px] font-bold text-white">
            {adminLabel.slice(0, 2).toUpperCase()}
          </div>
          <span className="hidden text-xs font-medium text-slate-600 sm:inline">{adminLabel}</span>
        </div>
      </div>
    </motion.header>
  );
}
