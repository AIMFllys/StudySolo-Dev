'use client';

import { useEffect, useRef } from 'react';
import {
  ClipboardPaste,
  Palette,
  Maximize,
  Minimize,
} from 'lucide-react';

export interface CanvasContextMenuItem {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}

interface CanvasContextMenuProps {
  x: number;
  y: number;
  items: CanvasContextMenuItem[];
  onClose: () => void;
}

export default function CanvasContextMenu({
  x,
  y,
  items,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Keep menu within viewport
  const adjustedStyle = {
    top: Math.min(y, window.innerHeight - items.length * 40 - 24),
    left: Math.min(x, window.innerWidth - 220),
  };

  return (
    <div
      ref={menuRef}
      className="canvas-context-menu"
      style={{
        position: 'fixed',
        top: adjustedStyle.top,
        left: adjustedStyle.left,
        zIndex: 1000,
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="canvas-context-menu-item"
          disabled={item.disabled}
          onClick={() => {
            item.onClick();
            onClose();
          }}
        >
          <span className="canvas-context-menu-icon">{item.icon}</span>
          <span className="canvas-context-menu-label">{item.label}</span>
          {item.shortcut && (
            <span className="canvas-context-menu-shortcut">{item.shortcut}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Prebuilt item builders ── */

export function buildCanvasMenuItems({
  onPaste,
  onToggleBg,
  isFullscreen,
  onToggleFullscreen,
}: {
  onPaste: () => void;
  onToggleBg: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}): CanvasContextMenuItem[] {
  return [
    {
      label: '粘贴节点',
      icon: <ClipboardPaste size={14} />,
      shortcut: 'Ctrl+V',
      onClick: onPaste,
    },
    {
      label: '切换背景色',
      icon: <Palette size={14} />,
      onClick: onToggleBg,
    },
    {
      label: isFullscreen ? '退出全屏' : '进入全屏',
      icon: isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />,
      shortcut: isFullscreen ? 'Esc' : '',
      onClick: onToggleFullscreen,
    },
  ];
}
