'use client';

import { useCallback, useState } from 'react';
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
import { toast } from 'sonner';
import { toggleFavorite as apiToggleFavorite, updateWorkflow } from '@/services/workflow.service';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { useWorkflowContextMenu } from '@/features/workflow/hooks/use-workflow-context-menu';
import { useWorkflowSidebarActions } from '@/features/workflow/hooks/use-workflow-sidebar-actions';
import {
  usePanelStore,
  IMMOVABLE_PANELS,
  PINNABLE_PANELS,
  type SidebarPanel,
  LEFT_PANEL_MIN,
  LEFT_PANEL_MAX,
} from '@/stores/use-panel-store';
import { useSettingsStore } from '@/stores/use-settings-store';
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
import SidebarActivityContextMenu from './sidebar/SidebarActivityContextMenu';
import type { LucideIcon } from 'lucide-react';
import type { WorkflowMeta } from '@/types/workflow';

interface SidebarProps {
  workflows: WorkflowMeta[];
}

// ─── 面板图标与标签字典 ───────────────────────────────────────────────────────
const PANEL_CONFIG: Record<SidebarPanel, { icon: LucideIcon; label: string }> = {
  'workflows':          { icon: LayoutList,       label: '工作流' },
  'ai-chat':            { icon: MessageSquareCode, label: 'AI 对话' },
  'node-store':         { icon: Store,             label: '节点商店' },
  'workflow-examples':  { icon: BookTemplate,      label: '工作流样例' },
  'dashboard':          { icon: LayoutDashboard,   label: '仪表盘' },
  'extensions':         { icon: Puzzle,            label: '功能拓展' },
  'wallet':             { icon: Wallet,            label: '钱包设置' },
  'user-panel':         { icon: UserCircle,        label: '用户面板' },
  'settings':           { icon: Settings,          label: '设置' },
  'execution':          { icon: PanelRightDashed,  label: '执行面板' },
};

/**
 * 不可移动的上区面板（user-panel 单独渲染，此处只含其余不可移动项，
 * extensions 总是显示在动态 Pinned 面板之后）
 */
const IMMOVABLE_UPPER: SidebarPanel[] = ['ai-chat', 'node-store'];

// ─── 右键菜单状态类型 ─────────────────────────────────────────────────────────
interface ContextMenuState {
  panel: SidebarPanel;
  anchorRect: DOMRect;
}

// ─── 面板 Header 标签查询 ─────────────────────────────────────────────────────
function getPanelLabel(panel: SidebarPanel): string {
  return PANEL_CONFIG[panel]?.label ?? '';
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
export default function Sidebar({ workflows }: SidebarProps) {
  const { pathname, isWorkflowActive, logoutAndRedirect, refreshRouter } =
    useSidebarNavigation();
  const bumpMarketplace = usePanelStore((s) => s.bumpMarketplaceVersion);
  const afterVisibilityChange = () => { bumpMarketplace(); refreshRouter(); };
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
    pinnedPanels,
    unpinPanel,
  } = usePanelStore();

  const isCollapsed = activeSidebarPanel === null;
  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const isRight = sidebarPosition === 'right';

  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [activityContextMenu, setActivityContextMenu] = useState<ContextMenuState | null>(null);

  // ─── 工作流重命名处理 ─────────────────────────────────────────────────────
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

  // ─── Activity Bar 右键处理 ────────────────────────────────────────────────
  const handleActivityContextMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, panel: SidebarPanel) => {
      // 仅 PINNABLE_PANELS 允许右键，IMMOVABLE_PANELS 静默忽略
      if ((IMMOVABLE_PANELS as readonly SidebarPanel[]).includes(panel)) return;

      e.preventDefault();
      e.stopPropagation();

      setActivityContextMenu({
        panel,
        anchorRect: e.currentTarget.getBoundingClientRect(),
      });
    },
    []
  );

  function handleUnpin(panel: SidebarPanel) {
    const label = getPanelLabel(panel);
    unpinPanel(panel);
    toast.success(`${label} 已移至功能拓展`);
    setActivityContextMenu(null);
  }

  // ─── 渲染 Activity Bar 按钮 ───────────────────────────────────────────────
  function renderActivityButton(panel: SidebarPanel) {
    const config = PANEL_CONFIG[panel];
    if (!config) return null;

    const { icon: Icon, label } = config;
    const isActive = activeSidebarPanel === panel;
    const isPinnable = (PINNABLE_PANELS as readonly SidebarPanel[]).includes(panel);

    return (
      <button
        key={panel}
        type="button"
        onClick={() => toggleSidebarPanel(panel)}
        onContextMenu={
          isPinnable
            ? (e) => handleActivityContextMenu(e, panel)
            : (e) => e.preventDefault() // 不可移动面板禁止原生右键
        }
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

  // ─── 动态组装 Activity Bar 上区面板顺序 ──────────────────────────────────
  // 顺序：[不可移动上区] → [用户 Pin 的面板] → [extensions（永远最后）]
  const dynamicPinnedInBar = pinnedPanels.filter(
    (p) => !(IMMOVABLE_PANELS as readonly SidebarPanel[]).includes(p)
  );

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`flex h-full shrink-0 ${
          isRight ? 'border-l flex-row-reverse' : 'border-r flex-row'
        } border-border`}
      >
        {/* ── Activity Bar（总是可见，固定宽度）──────────────────────────── */}
        <div className="flex h-full w-12 shrink-0 flex-col items-center bg-background py-2">

          {/* Execution 面板：仅在 Docked 时显示于最顶部 */}
          {rightPanelDockedToSidebar &&
            renderActivityButton('execution')
          }

          {/* 用户头像（永远第一，不可移动） */}
          {renderActivityButton('user-panel')}

          <div className="my-1 h-px w-6 bg-border/50" />

          {/* 不可移动的上区固定面板（ai-chat, node-store） */}
          <div className="space-y-1">
            {IMMOVABLE_UPPER.map((panel) => renderActivityButton(panel))}
          </div>

          {/* 用户动态 Pin 的面板（VSCode 风格：依序排列在不可移动项之后） */}
          {dynamicPinnedInBar.length > 0 && (
            <div className="space-y-1 mt-1">
              {dynamicPinnedInBar.map((panel) => renderActivityButton(panel))}
            </div>
          )}

          {/* 功能拓展（永远在上区最后一个，不可移动） */}
          <div className="mt-1">
            {renderActivityButton('extensions')}
          </div>

          {/* Spacer：将底部绝对区域推到底部 */}
          <div className="flex-1" />

          {/* ── Bottom Absolute Zone（不参与任何 pin 逻辑）────────────────── */}
          <div className="space-y-1">
            {/* 升级会员 */}
            <Link
              href="/upgrade"
              className="group relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-amber-500 transition-all border-[1.5px] border-transparent hover:border-amber-200/50 dark:hover:border-amber-900/30 hover:bg-amber-50/30 dark:hover:bg-amber-950/20"
              title="升级会员"
            >
              <div className="absolute inset-0 rounded-xl bg-amber-500/10 opacity-0 transition-opacity group-hover:animate-pulse group-hover:opacity-100" />
              <Crown className="h-[18px] w-[18px] stroke-[1.5] group-hover:stroke-[2]" />
            </Link>

            {/* 设置按钮 */}
            {renderActivityButton('settings')}

            {/* 使用手册（外链） */}
            <a
              href="https://docs.1037solo.com/#/docs/studysolo-intro"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground border-[1.5px] border-transparent transition-all hover:bg-muted/40 hover:text-foreground"
              title="使用手册"
            >
              <BookOpenText className="h-[18px] w-[18px] stroke-[1.5] hover:stroke-[2]" />
            </a>

            {/* 退出登录 */}
            <button
              onClick={() => void logoutAndRedirect()}
              className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground border-[1.5px] border-transparent transition-all hover:bg-rose-50/50 dark:hover:bg-rose-950/20 hover:text-rose-500"
              title="退出登录"
            >
              <LogOut className="h-[18px] w-[18px] stroke-[1.5] hover:stroke-[2]" />
            </button>
          </div>
        </div>

        {/* ── Panel Content（可折叠，可拖拽调整宽度）──────────────────────── */}
        {!isCollapsed && (
          <>
            <div
              className="hidden flex-col border-l border-border bg-background lg:flex"
              style={{ width: leftPanelWidth }}
            >
              {/* Panel Header */}
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

              {/* Panel Body */}
              {activeSidebarPanel === 'workflows' && (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <nav className="scrollbar-hide flex-1 overflow-y-auto py-2">
                    <InvitationList />
                    <SidebarWorkflowsPanel
                      workflows={workflows}
                      isWorkflowActive={isWorkflowActive}
                      handleContextMenu={handleContextMenu}
                      editingWorkflowId={editingWorkflowId}
                      handleRenameSubmit={handleRenameSubmit}
                      setEditingWorkflowId={setEditingWorkflowId}
                    />
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

            {/* Resizable Handle */}
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

      {/* ── Workflow 右键菜单 ──────────────────────────────────────────────── */}
      {contextMenu && (
        <SidebarContextMenu
          contextMenu={contextMenu}
          processingWorkflowId={processingWorkflowId}
          workflow={workflows.find((w) => w.id === contextMenu.workflowId)}
          onClose={closeContextMenu}
          onRename={handleRename}
          onDelete={handleDelete}
          onToggleFavorite={(id) => {
            closeContextMenu();
            apiToggleFavorite(id)
              .then((r) => {
                refreshRouter();
                toast.success(r.toggled ? '已加入收藏' : '已取消收藏');
              })
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : '收藏操作失败');
              });
          }}
          onTogglePublish={(id) => {
            const wf = workflows.find((w) => w.id === id);
            if (!wf) return;
            closeContextMenu();
            updateWorkflow(id, { is_public: !wf.is_public })
              .then(afterVisibilityChange)
              .then(() => {
                toast.success(wf.is_public ? '已取消公开' : '工作流已公开');
              })
              .catch((e: unknown) => {
                toast.error(e instanceof Error ? e.message : '发布操作失败');
              });
          }}
        />
      )}

      {/* ── Activity Bar 右键菜单（Portal 渲染至 body） ──────────────────── */}
      {activityContextMenu && (
        <SidebarActivityContextMenu
          anchorRect={activityContextMenu.anchorRect}
          panelLabel={getPanelLabel(activityContextMenu.panel)}
          isRight={isRight}
          onClose={() => setActivityContextMenu(null)}
          onUnpin={() => handleUnpin(activityContextMenu.panel)}
        />
      )}
    </>
  );
}
