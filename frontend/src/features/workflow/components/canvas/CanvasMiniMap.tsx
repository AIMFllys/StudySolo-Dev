'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MiniMap, useReactFlow } from '@xyflow/react';
import { Maximize2, Minimize2, Settings2, X, Map as MapIcon } from 'lucide-react';
import { useSettingsStore } from '@/stores/ui/use-settings-store';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';

export default function CanvasMiniMap() {
  const showMinimap = useSettingsStore((s) => s.showMinimap);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const { setCenter, getZoom } = useReactFlow();

  const [isLarge, setIsLarge] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Native DOM contextmenu listener ────────────────────────────────────────
  // MiniMap internally destructures props without ...rest, so onContextMenu
  // passed as a React prop is silently dropped. We attach directly to the
  // rendered DOM element via a class selector instead.
  useEffect(() => {
    if (!showMinimap || isMinimized) return;

    // Small delay to ensure MiniMap DOM is mounted
    const timer = setTimeout(() => {
      const el = document.querySelector('.react-flow__minimap');
      if (!el) return;

      const handler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const me = e as MouseEvent;
        setContextMenu({ x: me.clientX, y: me.clientY });
      };

      el.addEventListener('contextmenu', handler);

      // Store cleanup reference
      (cleanup as { current?: () => void }).current = () => {
        el.removeEventListener('contextmenu', handler);
      };
    }, 50);

    const cleanup: { current?: () => void } = {};
    return () => {
      clearTimeout(timer);
      cleanup.current?.();
    };
  }, [showMinimap, isMinimized, isLarge]);

  // ── Click node in minimap → pan canvas to that node ────────────────────────
  const handleMinimapNodeClick = useCallback(
    (
      _event: React.MouseEvent,
      node: {
        id: string;
        position?: { x: number; y: number };
        measured?: { width?: number; height?: number };
      },
    ) => {
      const x = (node.position?.x ?? 0) + (node.measured?.width ?? 200) / 2;
      const y = (node.position?.y ?? 0) + (node.measured?.height ?? 80) / 2;
      setCenter(x, y, { zoom: getZoom(), duration: 600 });
    },
    [setCenter, getZoom],
  );

  // ── Close context menu on outside click ────────────────────────────────────
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // ── Global off → render nothing ────────────────────────────────────────────
  if (!showMinimap) return null;

  // ── Minimized → show restore button ────────────────────────────────────────
  if (isMinimized) {
    return (
      <div className="absolute bottom-4 left-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-card text-muted-foreground shadow-lg backdrop-blur-sm transition-all hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-foreground"
          title="展开小地图"
        >
          <MapIcon className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <MiniMap
        pannable
        zoomable
        position="bottom-left"
        nodeBorderRadius={18}
        nodeStrokeWidth={selectedNodeId ? 2 : 1}
        nodeColor={(node) => (node.id === selectedNodeId ? '#818cf8' : 'var(--minimap-node-bg, #94a3b8)')}
        maskColor="var(--minimap-mask-bg, rgba(2, 6, 23, 0.45))"
        onNodeClick={handleMinimapNodeClick}
        style={{
          width: isLarge ? 300 : 200,
          height: isLarge ? 220 : 150,
        }}
        className="transition-all duration-300 ease-in-out !bg-card !border border-slate-200 dark:!border-white/[0.08] !rounded-2xl !shadow-lg cursor-context-menu"
      />

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-[100] w-48 overflow-hidden rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/[0.95] dark:bg-card/[0.95] p-1 shadow-2xl backdrop-blur-lg"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="flex flex-col">
            <button
              onClick={() => {
                setIsLarge(!isLarge);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isLarge ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isLarge ? '缩小尺寸' : '放大尺寸'}
            </button>
            <button
              onClick={() => {
                setIsMinimized(true);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Settings2 className="h-4 w-4" />
              最小化隐藏
            </button>
            <div className="my-1 h-px bg-slate-100 dark:bg-white/[0.08]" />
            <button
              onClick={() => setContextMenu(null)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
            >
              <X className="h-4 w-4" />
              取消
            </button>
          </div>
        </div>
      )}
    </>
  );
}
