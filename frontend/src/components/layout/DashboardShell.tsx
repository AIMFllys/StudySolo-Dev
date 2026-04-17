'use client';

import { useCreateWorkflowAction } from '@/features/workflow/hooks/use-create-workflow-action';
import Navbar from './Navbar';
import NavbarAutoHide from './NavbarAutoHide';
import MobileNav from './MobileNav';
import { DraggableAIChat } from '@/components/ai/DraggableAIChat';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const { creating, createWorkflow } = useCreateWorkflowAction();

  return (
    <>
      <NavbarAutoHide>
        <Navbar onNewWorkflow={createWorkflow} creating={creating} />
      </NavbarAutoHide>
      {children}
      <MobileNav onNewWorkflow={createWorkflow} creating={creating} />
      {/* Draggable AI Chat - mobile only */}
      <div className="md:hidden">
        <DraggableAIChat />
      </div>
    </>
  );
}
