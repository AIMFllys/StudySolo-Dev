'use client';

import {
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelLeftDashed,
  PanelRightDashed,
} from 'lucide-react';
import { usePanelStore, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX } from '@/stores/ui/use-panel-store';
import { useSettingsStore } from '@/stores/ui/use-settings-store';
import ResizableHandle from './ResizableHandle';
import RightPanelContent from './sidebar/RightPanelContent';
import MobileRightPanel from './MobileRightPanel';

export default function RightPanel() {
  const {
    rightPanelCollapsed,
    toggleRightPanel,
    rightPanelWidth,
    setRightPanelWidth,
    rightPanelDockedToSidebar,
    toggleRightPanelDock,
  } = usePanelStore();
  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const isRight = sidebarPosition === 'right';

  // When docked to sidebar, don't render anything on the right
  if (rightPanelDockedToSidebar) {
    return null;
  }

  /* ─── Collapsed strip ─── */
  if (rightPanelCollapsed) {
    const OpenIcon = isRight ? PanelLeftOpen : PanelRightOpen;
    return (
      <aside className={`hidden w-10 shrink-0 flex-col ${isRight ? 'border-r' : 'border-l'} border-border bg-background/95 md:flex`}>
        <button
          type="button"
          onClick={toggleRightPanel}
          className="flex h-10 w-full items-center justify-center text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          title="展开面板"
        >
          <OpenIcon className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  /* ─── Expanded panel ─── */
  return (
    <>
      <ResizableHandle
        side={isRight ? 'left' : 'right'}
        currentWidth={rightPanelWidth}
        onWidthChange={setRightPanelWidth}
        minWidth={RIGHT_PANEL_MIN}
        maxWidth={RIGHT_PANEL_MAX}
      />
      <aside
        className={`hidden shrink-0 flex-col ${isRight ? 'border-r' : 'border-l'} border-border bg-background/95 backdrop-blur md:flex`}
        style={{ width: rightPanelWidth }}
      >
        {/* Panel header with toggle + dock */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 shrink-0">
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            执行面板
          </span>
          <div className="flex items-center gap-0.5">
            {/* Dock to left sidebar button */}
            <button
              type="button"
              onClick={toggleRightPanelDock}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title={isRight ? '移动到右侧边栏' : '移动到左侧边栏'}
            >
              {isRight ? <PanelRightDashed className="h-4 w-4" /> : <PanelLeftDashed className="h-4 w-4" />}
            </button>
            {/* Collapse button */}
            <button
              type="button"
              onClick={toggleRightPanel}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              title="收起面板"
            >
              {isRight ? <PanelLeftClose className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Panel content (shared component) */}
        <RightPanelContent />
      </aside>

      {/* Mobile Right Panel */}
      <MobileRightPanel />
    </>
  );
}
