'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAdminStore } from '@/stores/use-admin-store';
import { ADMIN_NAV_ITEMS } from './AdminSidebar';

function resolvePageMeta(pathname: string) {
  const match = ADMIN_NAV_ITEMS.find((item) => {
    if (item.href === '/admin-analysis') return pathname === '/admin-analysis';
    return pathname.startsWith(item.href);
  });
  return match ?? { label: '后台', icon: 'dashboard' };
}

export function AdminTopbar() {
  const pathname = usePathname();
  const admin = useAdminStore((state) => state.admin);
  const page = useMemo(() => resolvePageMeta(pathname), [pathname]);

  return (
    <header className="flex h-11 w-full shrink-0 items-center justify-between border-b border-[#2e2e2e] bg-[#171717] px-5">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-medium text-[#666]">管理后台</span>
        <span className="text-[#333]">/</span>
        <span className="font-medium text-[#ededed]">{page.label}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3ecf8e]" />
          <span className="text-[11px] font-medium text-[#666]">{admin?.username ?? '管理员'}</span>
        </div>
      </div>
    </header>
  );
}
