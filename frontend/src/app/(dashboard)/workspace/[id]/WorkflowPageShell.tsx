'use client';

import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import RunButton from '@/features/workflow/components/toolbar/RunButton';
import RightPanel from '@/components/layout/RightPanel';
import { useWorkflowStore } from '@/stores/use-workflow-store';

interface WorkflowPageShellProps {
  workflowName: string;
  children: React.ReactNode;
}

export default function WorkflowPageShell({ workflowName, children }: WorkflowPageShellProps) {
  const isDirty = useWorkflowStore((s) => s.isDirty);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ─── Toolbar ─── */}
      <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/workspace"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            title="返回工作流列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="h-4 w-px bg-border" />

          <h1 className="truncate text-sm font-medium min-w-0 flex-1">{workflowName}</h1>

          {/* Save status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isDirty ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="hidden sm:inline">未保存</span>
              </>
            ) : (
              <>
                <Save className="h-3 w-3" />
                <span className="hidden sm:inline">已保存</span>
              </>
            )}
          </div>

          <div className="h-4 w-px bg-border" />

          <RunButton />
        </div>
      </div>

      {/* ─── Canvas + Right Panel (horizontal split) ─── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="relative flex-1 overflow-hidden">
          {children}
        </div>
        <RightPanel />
      </div>
    </div>
  );
}

