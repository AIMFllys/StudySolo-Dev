'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { LogOut, BookOpenText, Crown } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePanelStore,
  IMMOVABLE_PANELS,
  PINNABLE_PANELS,
  type SidebarPanel,
} from '@/stores/use-panel-store';
import { PANEL_CONFIG, IMMOVABLE_UPPER, getPanelLabel } from './sidebar-constants';
import SidebarActivityContextMenu from './sidebar/SidebarActivityContextMenu';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface SidebarActivityBarProps {
  logoutAndRedirect: () => Promise<void>;
  isRight: boolean;
}

export function SidebarActivityBar({ logoutAndRedirect, isRight }: SidebarActivityBarProps) {
  const {
    activeSidebarPanel, toggleSidebarPanel,
    rightPanelDockedToSidebar, pinnedPanels, unpinPanel,
  } = usePanelStore();

  const [activityContextMenu, setActivityContextMenu] = useState<{
    panel: SidebarPanel; anchorRect: DOMRect;
  } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleActivityContextMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, panel: SidebarPanel) => {
      if ((IMMOVABLE_PANELS as readonly SidebarPanel[]).includes(panel)) return;
      e.preventDefault();
      e.stopPropagation();
      setActivityContextMenu({ panel, anchorRect: e.currentTarget.getBoundingClientRect() });
    }, [],
  );

  function handleUnpin(panel: SidebarPanel) {
    unpinPanel(panel);
    toast.success(`${getPanelLabel(panel)} 已移至功能拓展`);
    setActivityContextMenu(null);
  }

  function renderButton(panel: SidebarPanel) {
    const config = PANEL_CONFIG[panel];
    if (!config) return null;
    const { icon: Icon, label } = config;
    const isActive = activeSidebarPanel === panel;
    const isPinnable = (PINNABLE_PANELS as readonly SidebarPanel[]).includes(panel);
    return (
      <button key={panel} type="button" onClick={() => toggleSidebarPanel(panel)}
        onContextMenu={isPinnable ? (e) => handleActivityContextMenu(e, panel) : (e) => e.preventDefault()}
        className={`relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl transition-all border-[1.5px] ${
          isActive ? 'node-paper-bg border-primary/30 shadow-sm text-primary scale-[1.02]'
            : 'border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground hover:scale-105'
        }`} title={label}>
        <Icon className={`h-[18px] w-[18px] ${isActive ? 'stroke-[2]' : 'stroke-[1.5]'}`} />
        {isActive && <span className="absolute -left-[1.5px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-md bg-primary/60" />}
      </button>
    );
  }

  const dynamicPinned = pinnedPanels.filter((p) => !(IMMOVABLE_PANELS as readonly SidebarPanel[]).includes(p));

  return (
    <>
      <div className="flex h-full w-12 shrink-0 flex-col items-center bg-background py-2 overflow-y-auto scrollbar-hide">
        {rightPanelDockedToSidebar && renderButton('execution')}
        {renderButton('user-panel')}
        <div className="my-1 h-px w-6 bg-border/50" />
        <div className="space-y-1">{IMMOVABLE_UPPER.map((p) => renderButton(p))}</div>
        {dynamicPinned.length > 0 && <div className="space-y-1 mt-1">{dynamicPinned.map((p) => renderButton(p))}</div>}
        <div className="mt-1">{renderButton('extensions')}</div>
        <div className="flex-1" />
        <div className="space-y-1">
          <Link href="/upgrade" className="group relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-amber-500 transition-all border-[1.5px] border-transparent hover:border-amber-200/50 dark:hover:border-amber-900/30 hover:bg-amber-50/30 dark:hover:bg-amber-950/20" title="升级会员">
            <div className="absolute inset-0 rounded-xl bg-amber-500/10 opacity-0 transition-opacity group-hover:animate-pulse group-hover:opacity-100" />
            <Crown className="h-[18px] w-[18px] stroke-[1.5] group-hover:stroke-[2]" />
          </Link>
          {renderButton('wallet')}
          {renderButton('settings')}
          <a href="https://docs.1037solo.com/#/docs/studysolo-intro" target="_blank" rel="noopener noreferrer"
            className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground border-[1.5px] border-transparent transition-all hover:bg-muted/40 hover:text-foreground" title="使用手册">
            <BookOpenText className="h-[18px] w-[18px] stroke-[1.5] hover:stroke-[2]" />
          </a>
          <button onClick={() => setShowLogoutConfirm(true)}
            className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl text-muted-foreground border-[1.5px] border-transparent transition-all hover:bg-rose-50/50 dark:hover:bg-rose-950/20 hover:text-rose-500" title="退出登录">
            <LogOut className="h-[18px] w-[18px] stroke-[1.5] hover:stroke-[2]" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showLogoutConfirm}
        title="确认退出登录"
        description="退出后需要重新登录才能访问工作流和学习数据。"
        confirmLabel="退出登录"
        variant="danger"
        onConfirm={() => { setShowLogoutConfirm(false); void logoutAndRedirect(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

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
