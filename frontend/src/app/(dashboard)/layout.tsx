import Sidebar from '@/components/layout/Sidebar';
import DashboardShell from '@/components/layout/DashboardShell';
import DashboardContentLayout from '@/components/layout/DashboardContentLayout';
import { fetchWorkflowListForServer } from '@/services/workflow.server.service';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workflows = await fetchWorkflowListForServer();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <DashboardShell>
        {/* DashboardContentLayout reads sidebarPosition client-side and applies flex direction */}
        <DashboardContentLayout>
          <div className="hidden h-full md:flex">
            <Sidebar workflows={workflows} />
          </div>

          <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
        </DashboardContentLayout>
      </DashboardShell>
    </div>
  );
}
