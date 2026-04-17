'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X,
  Pin,
  FileText,
  Lightbulb,
  BookOpen,
  LayoutDashboard,
  Wallet,
  Puzzle,
  User,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  description?: string;
}

const menuItems: MenuItem[] = [
  {
    id: 'workflows',
    label: '工作流列表',
    icon: FileText,
    href: '/workspace',
    color: 'bg-blue-500/10 text-blue-600',
    description: '查看全部工作流',
  },
  {
    id: 'examples',
    label: '工作流示例',
    icon: Lightbulb,
    href: '/workspace?tab=examples',
    color: 'bg-amber-500/10 text-amber-600',
    description: '快速开始模板',
  },
  {
    id: 'knowledge',
    label: '知识库',
    icon: BookOpen,
    href: '/settings?tab=knowledge',
    color: 'bg-emerald-500/10 text-emerald-600',
    description: '管理知识库',
  },
  {
    id: 'dashboard',
    label: '仪表盘',
    icon: LayoutDashboard,
    href: '/workspace',
    color: 'bg-purple-500/10 text-purple-600',
    description: '工作台概览',
  },
  {
    id: 'wallet',
    label: '钱包',
    icon: Wallet,
    href: '/settings?tab=wallet',
    color: 'bg-rose-500/10 text-rose-600',
    description: '余额与充值',
  },
  {
    id: 'extensions',
    label: '插件',
    icon: Puzzle,
    href: '/settings?tab=extensions',
    color: 'bg-cyan-500/10 text-cyan-600',
    description: '扩展功能',
  },
  {
    id: 'profile',
    label: '用户面板',
    icon: User,
    href: '/settings?tab=profile',
    color: 'bg-slate-500/10 text-slate-600',
    description: '个人设置',
  },
];

interface MobileTopMenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export function MobileTopMenuPanel({ isOpen, onClose, onToggle }: MobileTopMenuPanelProps) {
  const pathname = usePathname();
  const [isPinned, setIsPinned] = useState(false);
  const [isVisible, setIsVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key (unless pinned)
  useEffect(() => {
    if (!isOpen || isPinned) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isPinned, onClose]);

  const handleBackdropClick = useCallback(() => {
    if (!isPinned) {
      onClose();
    }
  }, [isPinned, onClose]);

  const handlePinToggle = () => {
    setIsPinned(!isPinned);
  };

  if (!isVisible && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`absolute left-0 right-0 top-0 bg-background shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : '-translate-y-full'
        }`}
        style={{
          maxHeight: '60vh',
          height: 'auto',
          borderBottomLeftRadius: '1.5rem',
          borderBottomRightRadius: '1.5rem',
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex flex-col items-center pt-3 pb-2 cursor-pointer"
          onClick={onToggle}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
          <span className="font-serif text-lg font-semibold">菜单</span>
          <div className="flex items-center gap-2">
            {/* Pin button */}
            <button
              onClick={handlePinToggle}
              className={`p-2 rounded-lg transition-colors ${
                isPinned ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground'
              }`}
              aria-label={isPinned ? '取消固定' : '固定到顶部'}
              title={isPinned ? '已固定' : '固定到顶部'}
            >
              <Pin className={`h-4 w-4 ${isPinned ? 'fill-current' : ''}`} />
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="关闭菜单"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="p-4 overflow-y-auto max-h-[calc(60vh-120px)]">
          <div className="grid grid-cols-3 gap-3">
            {menuItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href.split('?')[0]);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => {
                    if (!isPinned) onClose();
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary/10 ring-1 ring-primary/30'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.color}`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <span className={`text-xs font-medium block ${isActive ? 'text-primary' : ''}`}>
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {item.description}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="mt-4 pt-4 border-t border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 block">
              快捷操作
            </span>
            <div className="flex gap-2">
              <Link
                href="/workspace"
                onClick={() => !isPinned && onClose()}
                className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-colors"
              >
                <FileText className="h-4 w-4" />
                新建工作流
              </Link>
              <Link
                href="/settings?tab=help"
                onClick={() => !isPinned && onClose()}
                className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
              >
                帮助中心
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Pinned indicator */}
        {isPinned && (
          <div className="px-4 py-2 bg-primary/5 border-t border-border">
            <span className="text-xs text-primary flex items-center gap-1.5">
              <Pin className="h-3 w-3 fill-current" />
              菜单已固定，点击上方手柄或关闭按钮收起
            </span>
          </div>
        )}

        {/* Safe area */}
        <div className="h-safe-area-bottom" />
      </div>
    </div>
  );
}
