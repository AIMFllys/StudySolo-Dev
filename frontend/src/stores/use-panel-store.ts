'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── SidebarPanel 联合类型（'plugins' → 'extensions' 已更名） ───────────────
export type SidebarPanel =
  | 'workflows'
  | 'ai-chat'
  | 'node-store'
  | 'workflow-examples'
  | 'dashboard'
  | 'wallet'
  | 'extensions'   // ← 原 'plugins'，migrate 自动兼容旧 localStorage
  | 'user-panel'
  | 'settings'
  | 'execution';

// ─── 面板分类常量（导出供 Sidebar + ExtensionsPanel 使用） ────────────────────

/**
 * 永远出现在 Activity Bar 的不可移动面板。
 * 这些面板不会出现在右键菜单，也不会被 pin/unpin 管理。
 */
export const IMMOVABLE_PANELS: readonly SidebarPanel[] = [
  'user-panel',
  'ai-chat',
  'node-store',
  'extensions',
  'settings',
] as const;

/**
 * 用户可以 Pin/Unpin 的面板集合（不包含 settings）。
 * 顺序即 Activity Bar 的默认排列顺序。
 */
export const PINNABLE_PANELS: readonly SidebarPanel[] = [
  'workflows',
  'workflow-examples',
  'dashboard',
  'wallet',
] as const;

/** 默认固定的面板（全量 PINNABLE_PANELS） */
const DEFAULT_PINNED_PANELS: SidebarPanel[] = [
  'workflows',
  'workflow-examples',
  'dashboard',
  'wallet',
];

// ─── 面板尺寸约束 ─────────────────────────────────────────────────────────────
const LEFT_PANEL_MIN = 200;
const LEFT_PANEL_MAX = 480;
const LEFT_PANEL_DEFAULT = 240;
const RIGHT_PANEL_MIN = 240;
const RIGHT_PANEL_MAX = 520;
const RIGHT_PANEL_DEFAULT = 320;

// ─── Store 接口 ───────────────────────────────────────────────────────────────
interface PanelState {
  /** 当前激活的 Sidebar 面板（null = 侧边栏已折叠） */
  activeSidebarPanel: SidebarPanel | null;
  /** 可调整宽度的左侧面板宽度 */
  leftPanelWidth: number;
  /** 可调整宽度的右侧面板宽度 */
  rightPanelWidth: number;
  /** 右侧面板折叠状态 */
  rightPanelCollapsed: boolean;
  /** 右侧面板各 Section 折叠状态 */
  collapsedSections: Record<string, boolean>;
  /** 右侧面板是否停靠到左侧 Sidebar */
  rightPanelDockedToSidebar: boolean;
  /** 触发广场数据刷新的版本号计数器 */
  marketplaceVersion: number;

  /**
   * 用户固定在 Activity Bar 的面板列表（仅 PINNABLE_PANELS 中的项目）。
   * 数组顺序即 Activity Bar 中的渲染顺序。
   * 持久化至 localStorage。
   */
  pinnedPanels: SidebarPanel[];

  // ── 动作 ──
  /** 切换侧边栏面板：已激活则折叠，否则切换 */
  toggleSidebarPanel: (panel: SidebarPanel) => void;
  setActiveSidebarPanel: (panel: SidebarPanel | null) => void;
  setLeftPanelWidth: (width: number) => void;
  setRightPanelWidth: (width: number) => void;
  toggleRightPanel: () => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleSection: (sectionId: string) => void;
  isSectionCollapsed: (sectionId: string) => boolean;
  toggleRightPanelDock: () => void;
  bumpMarketplaceVersion: () => void;

  /**
   * 将面板固定到 Activity Bar（幂等操作）。
   * 只接受 PINNABLE_PANELS 中的面板，IMMOVABLE_PANELS 无效果。
   */
  pinPanel: (panel: SidebarPanel) => void;

  /**
   * 将面板从 Activity Bar 移除，移入功能拓展面板。
   * 若当前正在查看该面板，自动切换至 'extensions'。
   */
  unpinPanel: (panel: SidebarPanel) => void;
}

// ─── Store 实现 ───────────────────────────────────────────────────────────────
export const usePanelStore = create<PanelState>()(
  persist(
    (set, get) => ({
      activeSidebarPanel: 'workflows' as SidebarPanel | null,
      leftPanelWidth: LEFT_PANEL_DEFAULT,
      rightPanelWidth: RIGHT_PANEL_DEFAULT,
      rightPanelCollapsed: false,
      collapsedSections: {},
      rightPanelDockedToSidebar: false,
      marketplaceVersion: 0,
      pinnedPanels: DEFAULT_PINNED_PANELS,

      toggleSidebarPanel: (panel) =>
        set((state) => ({
          activeSidebarPanel: state.activeSidebarPanel === panel ? null : panel,
        })),

      setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),

      setLeftPanelWidth: (width) =>
        set({ leftPanelWidth: Math.min(LEFT_PANEL_MAX, Math.max(LEFT_PANEL_MIN, width)) }),

      setRightPanelWidth: (width) =>
        set({ rightPanelWidth: Math.min(RIGHT_PANEL_MAX, Math.max(RIGHT_PANEL_MIN, width)) }),

      toggleRightPanel: () =>
        set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),

      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),

      toggleSection: (sectionId) =>
        set((state) => ({
          collapsedSections: {
            ...state.collapsedSections,
            [sectionId]: !state.collapsedSections[sectionId],
          },
        })),

      isSectionCollapsed: (sectionId) => !!get().collapsedSections[sectionId],

      toggleRightPanelDock: () =>
        set((state) => {
          const docking = !state.rightPanelDockedToSidebar;
          return {
            rightPanelDockedToSidebar: docking,
            activeSidebarPanel: docking
              ? ('execution' as SidebarPanel)
              : ('node-store' as SidebarPanel),
          };
        }),

      bumpMarketplaceVersion: () =>
        set((state) => ({ marketplaceVersion: state.marketplaceVersion + 1 })),

      pinPanel: (panel) => {
        // IMMOVABLE_PANELS 已经固定在 Activity Bar，不参与 pinnedPanels 管理
        if ((IMMOVABLE_PANELS as readonly SidebarPanel[]).includes(panel)) return;
        set((state) => ({
          pinnedPanels: state.pinnedPanels.includes(panel)
            ? state.pinnedPanels
            : [...state.pinnedPanels, panel],
        }));
      },

      unpinPanel: (panel) => {
        // IMMOVABLE_PANELS 不可移动
        if ((IMMOVABLE_PANELS as readonly SidebarPanel[]).includes(panel)) return;
        set((state) => ({
          pinnedPanels: state.pinnedPanels.filter((p) => p !== panel),
          // 若当前正在查看被 unpin 的面板，自动切换到功能拓展面板
          activeSidebarPanel:
            state.activeSidebarPanel === panel ? 'extensions' : state.activeSidebarPanel,
        }));
      },
    }),

    {
      name: 'studysolo-panel-layout',

      // ── Version 1：修正 'plugins' → 'extensions'，注入 pinnedPanels 默认值 ──
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as Partial<PanelState>;

        if (version < 1) {
          // 兼容旧版：'plugins' 重命名为 'extensions'
          if ((state.activeSidebarPanel as string) === 'plugins') {
            state.activeSidebarPanel = 'extensions';
          }
          // 为没有 pinnedPanels 的旧客户端注入完整默认值
          if (!Array.isArray(state.pinnedPanels)) {
            state.pinnedPanels = [...DEFAULT_PINNED_PANELS];
          }
        }

        return state as PanelState;
      },

      // ── 仅持久化布局与用户偏好，排除函数与运行时状态 ──
      partialize: (state) => ({
        activeSidebarPanel: state.activeSidebarPanel,
        leftPanelWidth: state.leftPanelWidth,
        rightPanelWidth: state.rightPanelWidth,
        rightPanelCollapsed: state.rightPanelCollapsed,
        collapsedSections: state.collapsedSections,
        rightPanelDockedToSidebar: state.rightPanelDockedToSidebar,
        pinnedPanels: state.pinnedPanels,
      }),
    }
  )
);

export { LEFT_PANEL_MIN, LEFT_PANEL_MAX, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX };
