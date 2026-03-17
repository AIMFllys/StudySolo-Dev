import Sidebar from '@/components/layout/Sidebar';
import DashboardShell from '@/components/layout/DashboardShell';
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
        <div className="flex flex-1 overflow-hidden">
          <div className="hidden h-full md:flex">
            <Sidebar workflows={workflows} />
          </div>

          <main className="flex-1 overflow-auto pb-16 md:pb-0">{children}</main>
        </div>
      </DashboardShell>
    </div>
  );
}

