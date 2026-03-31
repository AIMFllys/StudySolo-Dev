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
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {isLoginPage ? (
        children
      ) : (
        <div className="flex h-screen overflow-hidden bg-[#fafaf8] font-[Inter,system-ui,sans-serif] text-slate-900">
          <AdminSidebar />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AdminTopbar />
            <main className="relative flex-1 overflow-auto">
              {/* Grid lines background */}
              <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, rgba(0,0,0,0.03) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0,0,0,0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: '32px 32px',
                }}
              />
              <div className="relative z-10">
                {children}
              </div>
            </main>
          </div>
        </div>
      )}
    </>
  );
}
