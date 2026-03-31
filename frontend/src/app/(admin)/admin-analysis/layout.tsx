'use client';

import { usePathname } from 'next/navigation';
import { AdminSidebar, AdminTopbar } from '@/features/admin/shared';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin-analysis/login';

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {isLoginPage ? (
        children
      ) : (
        <div className="flex h-screen overflow-hidden bg-[#1c1c1c] font-[Inter,system-ui,sans-serif] text-[#ededed] antialiased">
          <AdminSidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AdminTopbar />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      )}
    </>
  );
}
