import Sidebar from '@/components/layout/Sidebar';
import DashboardShell from '@/components/layout/DashboardShell';
import RightPanel from '@/components/layout/RightPanel';
import { createClient } from '@/utils/supabase/server';

// Server Component — fetches workflow list for SSR
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: workflows } = await supabase
    .from('workflows')
    .select('id, name, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* DashboardShell (Client Component) wraps Navbar + MobileNav with onNewWorkflow */}
      <DashboardShell>
        {/* Body: sidebar + main canvas area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar — hidden on mobile */}
          <div className="hidden md:flex h-full">
            <Sidebar workflows={workflows ?? []} />
          </div>

          {/* Center canvas area */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>

          {/* Right panel — hidden on mobile */}
          <RightPanel />
        </div>
      </DashboardShell>
    </div>
  );
}
