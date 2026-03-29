'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, PanelRightDashed } from 'lucide-react';
import { toast } from 'sonner';
import { toggleFavorite as apiToggleFavorite, updateWorkflow } from '@/services/workflow.service';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { useWorkflowContextMenu } from '@/features/workflow/hooks/use-workflow-context-menu';
import { useWorkflowSidebarActions } from '@/features/workflow/hooks/use-workflow-sidebar-actions';
import { usePanelStore, LEFT_PANEL_MIN, LEFT_PANEL_MAX } from '@/stores/use-panel-store';
import { useSettingsStore } from '@/stores/use-settings-store';
import { getPanelLabel } from './sidebar-constants';
import { SidebarActivityBar } from './SidebarActivityBar';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';
import { SidebarWorkflowsPanel } from './sidebar/SidebarWorkflowsPanel';
import { SidebarAIPanel } from './sidebar/SidebarAIPanel';
import NodeStorePanel from './sidebar/NodeStorePanel';
import WorkflowExamplesPanel from './sidebar/WorkflowExamplesPanel';
import DashboardPanel from './sidebar/DashboardPanel';
import WalletPanel from './sidebar/WalletPanel';
import ExtensionsPanel from './sidebar/ExtensionsPanel';
import UserPanel from './sidebar/UserPanel';
import SettingsPanel from './sidebar/SettingsPanel';
import SharedWorkflowsPanel from './sidebar/SharedWorkflowsPanel';
import InvitationList from './sidebar/InvitationList';
import RightPanelContent from './sidebar/RightPanelContent';
import ResizableHandle from './ResizableHandle';
import type { WorkflowMeta } from '@/types/workflow';

interface SidebarProps { workflows: WorkflowMeta[] }

export default function Sidebar({ workflows }: SidebarProps) {
  const { pathname, isWorkflowActive, logoutAndRedirect, refreshRouter } = useSidebarNavigation();
  const bumpMarketplace = usePanelStore((s) => s.bumpMarketplaceVersion);
  const afterVisibilityChange = () => { bumpMarketplace(); refreshRouter(); };
  const { contextMenu, handleContextMenu, closeContextMenu } = useWorkflowContextMenu();
  const { processingWorkflowId, onRenameWorkflow, onDeleteWorkflow } = useWorkflowSidebarActions(pathname, closeContextMenu);
  const { activeSidebarPanel, leftPanelWidth, setLeftPanelWidth, toggleRightPanelDock } = usePanelStore();

  const isCollapsed = activeSidebarPanel === null;
  const isRight = useSettingsStore((s) => s.sidebarPosition) === 'right';
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  function handleRename(workflowId: string) { setEditingWorkflowId(workflowId); closeContextMenu(); }
  async function handleRenameSubmit(workflowId: string, nextName: string) {
    setEditingWorkflowId(null);
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf || nextName === wf.name) return;
    await onRenameWorkflow(workflowId, nextName);
  }
  function handleDelete(workflowId: string) {
    void onDeleteWorkflow(workflowId, workflows.find((w) => w.id === workflowId)?.name ?? '未命名工作流');
  }

  return (
    <>
      <div className={`flex h-full shrink-0 ${isRight ? 'border-l flex-row-reverse' : 'border-r flex-row'} border-border`}>
        <SidebarActivityBar logoutAndRedirect={logoutAndRedirect} isRight={isRight} />

        {!isCollapsed && (
          <>
            <div className="hidden flex-col border-l border-border bg-background lg:flex" style={{ width: leftPanelWidth }}>
              {activeSidebarPanel !== 'ai-chat' && activeSidebarPanel !== 'node-store' && (
                <div className="shrink-0 border-b border-dashed border-border/50 px-3 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80 font-serif">
                    {getPanelLabel(activeSidebarPanel!)}
                  </span>
                  <div className="flex items-center gap-1">
                    {activeSidebarPanel === 'workflows' && (
                      <Link href="/workspace" className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-transparent text-muted-foreground transition-all hover:border-border/50 hover:bg-background/50 hover:text-primary hover:shadow-sm" title="主页">
                        <LayoutDashboard className="h-4 w-4 stroke-[1.5]" />
                      </Link>
                    )}
                    {activeSidebarPanel === 'execution' && (
                      <button type="button" onClick={toggleRightPanelDock} className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-transparent text-muted-foreground transition-all hover:border-border/50 hover:bg-background/50 hover:text-foreground hover:shadow-sm" title="移回右侧">
                        <PanelRightDashed className="h-4 w-4 stroke-[1.5]" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeSidebarPanel === 'workflows' && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <nav className="scrollbar-hide flex-1 overflow-y-auto py-2">
                    <InvitationList />
                    <SidebarWorkflowsPanel workflows={workflows} isWorkflowActive={isWorkflowActive}
                      handleContextMenu={handleContextMenu} editingWorkflowId={editingWorkflowId}
                      handleRenameSubmit={handleRenameSubmit} setEditingWorkflowId={setEditingWorkflowId} />
                    <SharedWorkflowsPanel />
                  </nav>
                </div>
              )}
              {activeSidebarPanel === 'ai-chat'           && <SidebarAIPanel />}
              {activeSidebarPanel === 'node-store'        && <NodeStorePanel />}
              {activeSidebarPanel === 'workflow-examples' && <WorkflowExamplesPanel />}
              {activeSidebarPanel === 'dashboard'         && <DashboardPanel />}
              {activeSidebarPanel === 'wallet'            && <WalletPanel />}
              {activeSidebarPanel === 'extensions'        && <ExtensionsPanel />}
              {activeSidebarPanel === 'user-panel'        && <UserPanel />}
              {activeSidebarPanel === 'settings'          && <SettingsPanel />}
              {activeSidebarPanel === 'execution'         && <RightPanelContent />}
            </div>
            <ResizableHandle side={isRight ? 'right' : 'left'} currentWidth={leftPanelWidth}
              onWidthChange={setLeftPanelWidth} minWidth={LEFT_PANEL_MIN} maxWidth={LEFT_PANEL_MAX} />
          </>
        )}
      </div>

      {contextMenu && (
        <SidebarContextMenu contextMenu={contextMenu} processingWorkflowId={processingWorkflowId}
          workflow={workflows.find((w) => w.id === contextMenu.workflowId)} onClose={closeContextMenu}
          onRename={handleRename} onDelete={handleDelete}
          onToggleFavorite={(id) => { closeContextMenu(); apiToggleFavorite(id).then((r) => { refreshRouter(); toast.success(r.toggled ? '已加入收藏' : '已取消收藏'); }).catch((e: unknown) => toast.error(e instanceof Error ? e.message : '收藏操作失败')); }}
          onTogglePublish={(id) => { const wf = workflows.find((w) => w.id === id); if (!wf) return; closeContextMenu(); updateWorkflow(id, { is_public: !wf.is_public }).then(afterVisibilityChange).then(() => toast.success(wf.is_public ? '已取消公开' : '工作流已公开')).catch((e: unknown) => toast.error(e instanceof Error ? e.message : '发布操作失败')); }}
        />
      )}
    </>
  );
}
