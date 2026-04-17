'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, FileText, Plus, Loader2 } from 'lucide-react';
import type { WorkflowMeta } from '@/types/workflow';
import { useCreateWorkflowAction } from '@/features/workflow/hooks/use-create-workflow-action';
import { MobileTopMenuPanel } from './MobileTopMenuPanel';

interface MobileSidebarProps {
  workflows: WorkflowMeta[];
}

interface MobileSidebarTriggerProps {
  variant?: 'default' | 'canvas';
}

export function MobileSidebarTrigger({ variant = 'default' }: MobileSidebarTriggerProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Canvas variant: positioned below HistoryControls (undo/redo buttons)
  // Default variant: positioned at top-left
  const positionClasses = variant === 'canvas'
    ? 'top-[80px] left-4'  // Below HistoryControls (~64px + padding)
    : 'top-3 left-3';       // Default top-left

  const handleToggle = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        className={`md:hidden fixed z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-background/95 backdrop-blur-md border border-border shadow-sm transition-all active:scale-95 ${positionClasses}`}
        aria-label="打开菜单"
      >
        <Menu className="h-5 w-5 text-foreground" />
      </button>
      <MobileTopMenuPanel
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onToggle={handleToggle}
      />
    </>
  );
}

function MobileSidebarSheet({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { creating, createWorkflow } = useCreateWorkflowAction();

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleNewWorkflow = async () => {
    await createWorkflow();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div className="absolute left-0 top-0 bottom-0 w-[280px] max-w-[80vw] bg-background border-r border-border shadow-2xl animate-in slide-in-from-left duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">工作流列表</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="关闭侧边栏"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Workflow Button */}
        <div className="p-4 border-b border-border">
          <button
            onClick={() => void handleNewWorkflow()}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-2.5 px-4 text-sm font-medium shadow-sm disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {creating ? '创建中...' : '新建工作流'}
          </button>
        </div>

        {/* Workflow List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[calc(100vh-180px)]">
          <MobileWorkflowList onItemClick={onClose} currentPath={pathname} />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Link
            href="/workspace"
            onClick={onClose}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>查看全部工作流</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MobileWorkflowList({
  onItemClick,
  currentPath,
}: {
  onItemClick: () => void;
  currentPath: string;
}) {
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/workflow/list')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWorkflows(data.slice(0, 10)); // Show recent 10
        }
      })
      .catch(() => {
        // Silent fail
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <p>暂无工作流</p>
        <p className="text-xs mt-1">新建一个开始吧</p>
      </div>
    );
  }

  return (
    <nav className="space-y-1">
      {workflows.map((wf) => {
        const isActive = currentPath === `/c/${wf.id}`;
        return (
          <Link
            key={wf.id}
            href={`/c/${wf.id}`}
            onClick={onItemClick}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <FileText className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="truncate flex-1">{wf.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
