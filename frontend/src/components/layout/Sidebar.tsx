'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LayoutList,
  MessageSquareCode,
  Store,
  BookTemplate,
  LayoutDashboard,
  Puzzle,
  Wallet,
  Settings,
  LogOut,
  BookOpenText,
  UserCircle,
  PanelRightDashed,
  Crown,
} from 'lucide-react';
import { getUser, type UserInfo } from '@/services/auth.service';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { useWorkflowContextMenu } from '@/features/workflow/hooks/use-workflow-context-menu';
import { useWorkflowSidebarActions } from '@/features/workflow/hooks/use-workflow-sidebar-actions';
import { usePanelStore, type SidebarPanel, LEFT_PANEL_MIN, LEFT_PANEL_MAX } from '@/stores/use-panel-store';
import { useSettingsStore } from '@/stores/use-settings-store';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';
import { SidebarWorkflowsPanel } from './sidebar/SidebarWorkflowsPanel';
import { SidebarAIPanel } from './sidebar/SidebarAIPanel';
import NodeStorePanel from './sidebar/NodeStorePanel';
import WorkflowExamplesPanel from './sidebar/WorkflowExamplesPanel';
import DashboardPanel from './sidebar/DashboardPanel';
import WalletPanel from './sidebar/WalletPanel';
import PluginsPanel from './sidebar/PluginsPanel';
import UserPanel from './sidebar/UserPanel';
import SettingsPanel from './sidebar/SettingsPanel';
import RightPanelContent from './sidebar/RightPanelContent';
import ResizableHandle from './ResizableHandle';
import type { LucideIcon } from 'lucide-react';

export interface WorkflowMeta {
  id: string;
  name: string;
  updated_at: string;
  isRunning?: boolean;
  is_favorite?: boolean;
  is_published?: boolean;
}

interface SidebarProps {
  workflows: WorkflowMeta[];
}

/* ─── Panel config — upper zone (core feature panels) ─── */
const UPPER_PANELS: { panel: SidebarPanel; icon: LucideIcon; label: string }[] = [
  { panel: 'workflows', icon: LayoutList, label: '工作流' },
  { panel: 'ai-chat', icon: MessageSquareCode, label: 'AI 对话' },
  { panel: 'node-store', icon: Store, label: '节点商店' },
  { panel: 'workflow-examples', icon: BookTemplate, label: '工作流样例' },
  { panel: 'dashboard', icon: LayoutDashboard, label: '仪表盘' },
  { panel: 'plugins', icon: Puzzle, label: '插件' },
];

/* ─── Panel config — lower zone (tools/settings) ─── */
const LOWER_PANELS: { panel: SidebarPanel; icon: LucideIcon; label: string }[] = [
  { panel: 'wallet', icon: Wallet, label: '钱包设置' },
];

/** Get the panel label for the active panel */
function getPanelLabel(panel: SidebarPanel): string {
  const ALL: Record<SidebarPanel, string> = {
    'workflows': '工作流',
    'ai-chat': 'AI 对话',
    'node-store': '节点商店',
    'workflow-examples': '工作流样例',
    'dashboard': '仪表盘',
    'plugins': '插件',
    'wallet': '钱包设置',
    'user-panel': '用户面板',
    'settings': '设置',
    'execution': '执行面板',
  };
  return ALL[panel] ?? '';
}

export default function Sidebar({ workflows }: SidebarProps) {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  const { pathname, isWorkflowActive, logoutAndRedirect } =
    useSidebarNavigation();
  const { contextMenu, handleContextMenu, closeContextMenu } =
    useWorkflowContextMenu();
  const { processingWorkflowId, onRenameWorkflow, onDeleteWorkflow } =
    useWorkflowSidebarActions(pathname, closeContextMenu);

  const {
    activeSidebarPanel,
    toggleSidebarPanel,
    leftPanelWidth,
    setLeftPanelWidth,
    rightPanelDockedToSidebar,
    toggleRightPanelDock,
  } = usePanelStore();
  const isCollapsed = activeSidebarPanel === null;
  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const isRight = sidebarPosition === 'right';

  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);

  function handleRename(workflowId: string) {
    setEditingWorkflowId(workflowId);
    closeContextMenu();
  }

  async function handleRenameSubmit(workflowId: string, nextName: string) {
    setEditingWorkflowId(null);
    const workflow = workflows.find((item) => item.id === workflowId);
    if (!workflow || nextName === workflow.name) return;
    await onRenameWorkflow(workflowId, nextName);
  }

  function handleDelete(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    void onDeleteWorkflow(workflowId, workflow?.name ?? '未命名工作流');
  }

  function renderActivityButton(
    panel: SidebarPanel,
    icon: LucideIcon,
    label: string
  ) {
    const Icon = icon;
    const isActive = activeSidebarPanel === panel;
    return (
      <button
        key={panel}
        type="button"
        onClick={() => toggleSidebarPanel(panel)}
        className={`relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all border-[1.5px] ${
          isActive
            ? 'node-paper-bg border-primary/30 shadow-sm text-primary scale-[1.02]'
            : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:scale-105'
        }`}
        title={label}
      >
        <Icon className={`h-[18px] w-[18px] ${isActive ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
        {isActive && (
          <span className="absolute -left-[1.5px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-md bg-primary/60" />
        )}
      </button>
    );
  }

  return (
    <>
      <div className={`flex h-full shrink-0 ${isRight ? 'border-l flex-row-reverse' : 'border-r flex-row'} border-border`}>
        {/* ─── Activity Bar (always visible, fixed width) ─── */}
        <div className="flex h-full w-12 shrink-0 flex-col items-center bg-background py-2">
          {/* Execution panel — pinned at absolute top when docked */}
          {rightPanelDockedToSidebar &&
            renderActivityButton('execution', PanelRightDashed, '执行面板')
          }

          {/* User panel button - Standard icon */}
          {renderActivityButton('user-panel', UserCircle, '用户面板')}

          <div className="my-1 h-px w-6 bg-border/50" />

          {/* Upper zone — core feature panels */}
          <div className="space-y-1">
            {UPPER_PANELS.map(({ panel, icon, label }) =>
              renderActivityButton(panel, icon, label)
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Lower zone — tools & settings */}
          <div className="space-y-1">
            {/* Upgrade button */}
            <Link
              href="/upgrade"
              className="group relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-amber-500 transition-all border-[1.5px] border-transparent hover:border-amber-200/50 dark:hover:border-amber-900/30 hover:bg-amber-50/30 dark:hover:bg-amber-950/20"
              title="升级会员"
            >
              <div className="absolute inset-0 rounded-xl bg-amber-500/10 opacity-0 transition-opacity group-hover:animate-pulse group-hover:opacity-100" />
              <Crown className="h-[18px] w-[18px] stroke-[1.5] group-hover:stroke-[2]" />
            </Link>

            {LOWER_PANELS.map(({ panel, icon, label }) =>
              renderActivityButton(panel, icon, label)
            )}

            {/* 使用手册 (external link) */}
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-intro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground border-[1.5px] border-transparent transition-all hover:bg-muted/40 hover:text-foreground"
              title="使用手册"
            >
              <BookOpenText className="h-[18px] w-[18px] stroke-[1.5] hover:stroke-[2]" />
            </a>

            {/* Settings — opens sidebar panel */}
            {renderActivityButton('settings', Settings, '设置')}

            <button
              onClick={() => void logoutAndRedirect()}
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground border-[1.5px] border-transparent transition-all hover:bg-rose-50/50 dark:hover:bg-rose-950/20 hover:text-rose-500"
              title="退出登录"
            >
              <LogOut className="h-[18px] w-[18px] stroke-[1.5] hover:stroke-[2]" />
            </button>
          </div>
        </div>

        {/* ─── Panel Content (collapsible, resizable) ─── */}
        {!isCollapsed && (
          <>
            <div
              className="hidden flex-col border-l border-border bg-background lg:flex"
              style={{ width: leftPanelWidth }}
            >
              {/* Panel header */}
              {activeSidebarPanel !== 'ai-chat' && (
                <div className="shrink-0 border-b border-dashed border-border/50 px-3 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80 font-serif">
                    {getPanelLabel(activeSidebarPanel!)}
                  </span>
                  
                  <div className="flex items-center gap-1">
                    {activeSidebarPanel === 'workflows' && (
                      <Link
                        href="/workspace"
                        className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-transparent text-muted-foreground transition-all hover:border-border/50 hover:bg-background/50 hover:text-primary hover:shadow-sm"
                        title="主页"
                      >
                        <LayoutDashboard className="h-4 w-4 stroke-[1.5]" />
                      </Link>
                    )}

                    {/* Undock button — only for execution panel */}
                    {activeSidebarPanel === 'execution' && (
                      <button
                        type="button"
                        onClick={toggleRightPanelDock}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] border-transparent text-muted-foreground transition-all hover:border-border/50 hover:bg-background/50 hover:text-foreground hover:shadow-sm"
                        title="移回右侧"
                      >
                        <PanelRightDashed className="h-4 w-4 stroke-[1.5]" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Panel body */}
              {activeSidebarPanel === 'workflows' && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <nav className="scrollbar-hide flex-1 overflow-y-auto py-2">
                    <SidebarWorkflowsPanel 
                      workflows={workflows} 
                      isWorkflowActive={isWorkflowActive} 
                      handleContextMenu={handleContextMenu} 
                      editingWorkflowId={editingWorkflowId}
                      handleRenameSubmit={handleRenameSubmit}
                      setEditingWorkflowId={setEditingWorkflowId}
                    />
                  </nav>
                </div>
              )}

              {activeSidebarPanel === 'ai-chat' && <SidebarAIPanel />}
              {activeSidebarPanel === 'node-store' && <NodeStorePanel />}
              {activeSidebarPanel === 'workflow-examples' && <WorkflowExamplesPanel />}
              {activeSidebarPanel === 'dashboard' && <DashboardPanel />}
              {activeSidebarPanel === 'wallet' && <WalletPanel />}
              {activeSidebarPanel === 'plugins' && <PluginsPanel />}
              {activeSidebarPanel === 'user-panel' && <UserPanel />}
              {activeSidebarPanel === 'settings' && <SettingsPanel />}
              {activeSidebarPanel === 'execution' && <RightPanelContent />}
            </div>

            {/* Resizable handle */}
            <ResizableHandle
              side={isRight ? 'right' : 'left'}
              currentWidth={leftPanelWidth}
              onWidthChange={setLeftPanelWidth}
              minWidth={LEFT_PANEL_MIN}
              maxWidth={LEFT_PANEL_MAX}
            />
          </>
        )}
      </div>

      {contextMenu ? (
        <SidebarContextMenu
          contextMenu={contextMenu}
          processingWorkflowId={processingWorkflowId}
          workflow={workflows.find(w => w.id === contextMenu.workflowId)}
          onClose={closeContextMenu}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : null}
    </>
  );
}
