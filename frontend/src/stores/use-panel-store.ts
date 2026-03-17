'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarPanel = 'workflows' | 'ai-chat';

interface PanelState {
  /** Which sidebar panel is active (null = sidebar collapsed) */
  activeSidebarPanel: SidebarPanel | null;
  /** Right panel collapsed state */
  rightPanelCollapsed: boolean;
  /** Right panel section collapsed states */
  collapsedSections: Record<string, boolean>;

  /** Toggle a sidebar panel — if already active, collapse; if different, switch */
  toggleSidebarPanel: (panel: SidebarPanel) => void;
  setActiveSidebarPanel: (panel: SidebarPanel | null) => void;

  toggleRightPanel: () => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  toggleSection: (sectionId: string) => void;
  isSectionCollapsed: (sectionId: string) => boolean;
}

export const usePanelStore = create<PanelState>()(
  persist(
    (set, get) => ({
      activeSidebarPanel: 'workflows' as SidebarPanel | null,
      rightPanelCollapsed: false,
      collapsedSections: {},

      toggleSidebarPanel: (panel) =>
        set((state) => ({
          activeSidebarPanel: state.activeSidebarPanel === panel ? null : panel,
        })),

      setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel }),

      toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      setRightPanelCollapsed: (collapsed) => set({ rightPanelCollapsed: collapsed }),

      toggleSection: (sectionId) =>
        set((state) => ({
          collapsedSections: {
            ...state.collapsedSections,
            [sectionId]: !state.collapsedSections[sectionId],
          },
        })),

      isSectionCollapsed: (sectionId) => !!get().collapsedSections[sectionId],
    }),
    {
      name: 'studysolo-panel-layout',
      partialize: (state) => ({
        activeSidebarPanel: state.activeSidebarPanel,
        rightPanelCollapsed: state.rightPanelCollapsed,
        collapsedSections: state.collapsedSections,
      }),
    }
  )
);

