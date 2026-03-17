'use client';

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
} from 'lucide-react';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { useWorkflowContextMenu } from '@/features/workflow/hooks/use-workflow-context-menu';
import { useWorkflowSidebarActions } from '@/features/workflow/hooks/use-workflow-sidebar-actions';
import { usePanelStore, type SidebarPanel, LEFT_PANEL_MIN, LEFT_PANEL_MAX } from '@/stores/use-panel-store';
import { useSettingsStore } from '@/stores/use-settings-store';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';
import { SidebarWorkflowItem } from './sidebar/SidebarWorkflowItem';
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

  function handleRename(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    void onRenameWorkflow(workflowId, workflow?.name ?? '未命名工作流');
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
        className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
          isActive
            ? 'bg-white/8 text-foreground'
            : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
        }`}
        title={label}
      >
        <Icon className="h-[18px] w-[18px]" />
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary" />
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

          {/* User panel button */}
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
            {LOWER_PANELS.map(({ panel, icon, label }) =>
              renderActivityButton(panel, icon, label)
            )}

            {/* 使用手册 (external link) */}
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-intro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title="使用手册"
            >
              <BookOpenText className="h-[18px] w-[18px]" />
            </a>

            {/* Settings — opens sidebar panel */}
            {renderActivityButton('settings', Settings, '设置')}

            <button
              onClick={() => void logoutAndRedirect()}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title="退出登录"
            >
              <LogOut className="h-[18px] w-[18px]" />
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
              <div className="shrink-0 border-b border-border px-3 py-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {getPanelLabel(activeSidebarPanel!)}
                </span>

                {/* Undock button — only for execution panel */}
                {activeSidebarPanel === 'execution' && (
                  <button
                    type="button"
                    onClick={toggleRightPanelDock}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                    title="移回右侧"
                  >
                    <PanelRightDashed className="h-3.5 w-3.5" />
                  </button>
                )}
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
          onClose={closeContextMenu}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : null}
    </>
  );
}
