'use client';

import Link from 'next/link';
import { LayoutList, BookOpen, Settings, LogOut, Sparkles } from 'lucide-react';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { useWorkflowContextMenu } from '@/features/workflow/hooks/use-workflow-context-menu';
import { useWorkflowSidebarActions } from '@/features/workflow/hooks/use-workflow-sidebar-actions';
import { usePanelStore, type SidebarPanel } from '@/stores/use-panel-store';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';
import { SidebarWorkflowItem } from './sidebar/SidebarWorkflowItem';
import { SidebarAIPanel } from './sidebar/SidebarAIPanel';

export interface WorkflowMeta {
  id: string;
  name: string;
  updated_at: string;
  isRunning?: boolean;
}

interface SidebarProps {
  workflows: WorkflowMeta[];
}

const PANEL_CONFIG: Record<SidebarPanel, { icon: typeof LayoutList; label: string }> = {
  workflows: { icon: LayoutList, label: '工作流' },
  'ai-chat': { icon: Sparkles, label: 'AI 对话' },
};

export default function Sidebar({ workflows }: SidebarProps) {
  const { pathname, settingsActive, knowledgeActive, isWorkflowActive, logoutAndRedirect } =
    useSidebarNavigation();
  const { contextMenu, handleContextMenu, closeContextMenu } =
    useWorkflowContextMenu();
  const { processingWorkflowId, onRenameWorkflow, onDeleteWorkflow } =
    useWorkflowSidebarActions(pathname, closeContextMenu);

  const { activeSidebarPanel, toggleSidebarPanel } = usePanelStore();
  const isCollapsed = activeSidebarPanel === null;

  function handleRename(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    void onRenameWorkflow(workflowId, workflow?.name ?? '未命名工作流');
  }

  function handleDelete(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    void onDeleteWorkflow(workflowId, workflow?.name ?? '未命名工作流');
  }

  return (
    <>
      <div className="flex h-full shrink-0 border-r border-border">
        {/* ─── Activity Bar (always visible) ─── */}
        <div className="flex h-full w-12 shrink-0 flex-col items-center bg-background py-2">
          {/* Panel toggle buttons */}
          <div className="space-y-1">
            {(Object.entries(PANEL_CONFIG) as [SidebarPanel, typeof PANEL_CONFIG[SidebarPanel]][]).map(
              ([panel, config]) => {
                const isActive = activeSidebarPanel === panel;
                return (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => toggleSidebarPanel(panel)}
                    className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/8 text-foreground'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                    }`}
                    title={config.label}
                  >
                    <config.icon className="h-[18px] w-[18px]" />
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
                    )}
                  </button>
                );
              }
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom nav links */}
          <div className="space-y-1">
            <Link
              href="/knowledge"
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                knowledgeActive
                  ? 'bg-white/8 text-foreground'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
              title="知识库"
            >
              <BookOpen className="h-[18px] w-[18px]" />
            </Link>
            <Link
              href="/settings"
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                settingsActive
                  ? 'bg-white/8 text-foreground'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
              title="设置"
            >
              <Settings className="h-[18px] w-[18px]" />
            </Link>
            <button
              onClick={() => void logoutAndRedirect()}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title="退出登录"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* ─── Panel Content (collapsible) ─── */}
        {!isCollapsed && (
          <div className="hidden w-[240px] flex-col border-l border-border bg-background lg:flex">
            {/* Panel header */}
            <div className="shrink-0 border-b border-border px-3 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {PANEL_CONFIG[activeSidebarPanel!].label}
              </span>
            </div>

            {/* Panel body */}
            {activeSidebarPanel === 'workflows' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <nav className="scrollbar-hide flex-1 overflow-y-auto py-2">
                  {workflows.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">暂无工作流</p>
                  ) : null}
                  {workflows.map((workflow) => (
                    <SidebarWorkflowItem
                      key={workflow.id}
                      workflow={workflow}
                      active={isWorkflowActive(workflow.id)}
                      onContextMenu={handleContextMenu}
                    />
                  ))}
                </nav>
              </div>
            )}

            {activeSidebarPanel === 'ai-chat' && <SidebarAIPanel />}
          </div>
        )}
      </div>

      {contextMenu ? (
        <SidebarContextMenu
          contextMenu={contextMenu}
          processingWorkflowId={processingWorkflowId}
          onClose={closeContextMenu}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : null}
    </>
  );
}
