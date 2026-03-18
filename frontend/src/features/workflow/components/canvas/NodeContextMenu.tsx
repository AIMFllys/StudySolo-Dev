'use client';

import { useEffect, useRef } from 'react';
import {
  Copy,
  Trash2,
  Settings2,
  Unplug,
  Repeat,
  Bookmark,
  FileText,
} from 'lucide-react';

export interface NodeContextMenuItem {
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

export interface NodeContextMenuGroup {
  items: NodeContextMenuItem[];
}

interface NodeContextMenuProps {
  x: number;
  y: number;
  groups: NodeContextMenuGroup[];
  onClose: () => void;
}

export default function NodeContextMenu({
  x,
  y,
  groups,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

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

  const totalItems = groups.reduce((acc, g) => acc + g.items.length, 0) + groups.length - 1;

  const adjustedStyle = {
    top: Math.min(y, window.innerHeight - totalItems * 36 - 24),
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
      {groups.map((group, gi) => (
        <div key={gi}>
          {gi > 0 && <div className="canvas-context-menu-divider" />}
          {group.items.map((item, ii) => (
            <button
              key={ii}
              className={`canvas-context-menu-item ${item.danger ? 'canvas-context-menu-danger' : ''}`}
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
      ))}
    </div>
  );
}

/* ── Prebuilt node menu groups ── */

export function buildNodeMenuGroups({
  onCopy,
  onDelete,
}: {
  onCopy: () => void;
  onDelete: () => void;
}): NodeContextMenuGroup[] {
  return [
    {
      items: [
        {
          label: '复制节点',
          icon: <Copy size={14} />,
          shortcut: 'Ctrl+C',
          onClick: onCopy,
        },
      ],
    },
    {
      items: [
        {
          label: '节点配置',
          icon: <Settings2 size={14} />,
          disabled: true,
          onClick: () => {},
        },
        {
          label: '重新执行',
          icon: <Repeat size={14} />,
          disabled: true,
          onClick: () => {},
        },
        {
          label: '断开连接',
          icon: <Unplug size={14} />,
          disabled: true,
          onClick: () => {},
        },
      ],
    },
    {
      items: [
        {
          label: '添加备注',
          icon: <Bookmark size={14} />,
          disabled: true,
          onClick: () => {},
        },
        {
          label: '导出数据',
          icon: <FileText size={14} />,
          disabled: true,
          onClick: () => {},
        },
      ],
    },
    {
      items: [
        {
          label: '删除节点',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: onDelete,
        },
      ],
    },
  ];
}
