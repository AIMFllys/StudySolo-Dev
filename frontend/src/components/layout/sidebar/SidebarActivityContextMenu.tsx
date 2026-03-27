'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pin } from 'lucide-react';

interface SidebarActivityContextMenuProps {
  /** 触发右键的元素 ClientRect（用于定位菜单） */
  anchorRect: DOMRect;
  /** 当前面板的显示名称（Toast 时使用） */
  panelLabel: string;
  /** 侧边栏是否在右侧 */
  isRight: boolean;
  /** 关闭菜单回调 */
  onClose: () => void;
  /** 取消固定回调 */
  onUnpin: () => void;
}

/**
 * Activity Bar 右键上下文菜单。
 *
 * 渲染策略：createPortal 至 document.body，
 * 规避父级 overflow-hidden 裁切 + 侧边栏左右切换时的坐标偏移。
 */
export default function SidebarActivityContextMenu({
  anchorRect,
  panelLabel,
  isRight,
  onClose,
  onUnpin,
}: SidebarActivityContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // ── 计算菜单弹出位置（与图标顶部对齐，横向贴紧侧边栏边界） ─────────────────────────────────
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.top,
    zIndex: 9999,
  };

  if (isRight) {
    // 侧边栏在右侧，向左弹出
    menuStyle.right = window.innerWidth - anchorRect.left + 8;
  } else {
    // 侧边栏在左侧，向右弹出
    menuStyle.left = anchorRect.right + 8;
  }

  // ── 点击菜单外区域关闭 ──────────────────────────────────────────────────────
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // 使用 mousedown 确保比 click 更早触发，防止事件泄漏
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // ── ESC 键关闭 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const menu = (
    <div
      ref={menuRef}
      style={menuStyle}
      role="menu"
      aria-label={`${panelLabel} 面板操作`}
      className="node-paper-bg min-w-[160px] rounded-xl border-[1.5px] border-border/60 shadow-xl py-1 overflow-hidden"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onUnpin();
          onClose();
        }}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-muted/60 rounded-lg mx-1 my-0.5"
        style={{ width: 'calc(100% - 8px)' }}
      >
        <Pin className="h-3.5 w-3.5 stroke-[1.5] text-muted-foreground shrink-0" />
        <span>取消固定</span>
        <span className="ml-auto text-[10px] text-muted-foreground/60 font-mono">
          移至功能拓展
        </span>
      </button>
    </div>
  );

  // ── 服务端渲染安全检查 ───────────────────────────────────────────────────────
  if (typeof document === 'undefined') return null;

  return createPortal(menu, document.body);
}
