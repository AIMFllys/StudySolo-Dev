'use client';

import { ArrowLeft, Save, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import RightPanel from '@/components/layout/RightPanel';
import CollaborationPopover from '@/features/workflow/components/collaboration/CollaborationPopover';
import CollaboratorAvatars from '@/features/workflow/components/collaboration/CollaboratorAvatars';
import RunHistoryPopover from '@/features/workflow/components/history/RunHistoryPopover';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { useSettingsStore } from '@/stores/ui/use-settings-store';

interface WorkflowPageShellProps {
  workflowId?: string;
  workflowName: string;
  isPublic?: boolean;
  isOwner?: boolean;
  children: React.ReactNode;
}

export default function WorkflowPageShell({
  workflowId,
  workflowName,
  isPublic = false,
  isOwner = false,
  children,
}: WorkflowPageShellProps) {
  const isDirty = useWorkflowStore((s) => s.isDirty);
  const sidebarPosition = useSettingsStore((s) => s.sidebarPosition);
  const isRight = sidebarPosition === 'right';

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ─── Slim info bar ─── */}
      <div className="relative z-[60] shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-1.5 pointer-events-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/workspace"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="返回工作流列表"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>

          <div className="h-3.5 w-px bg-border" />

          <h1 className="truncate text-xs font-medium min-w-0 flex-1">{workflowName}</h1>

          {/* Public link shortcut — visible only when workflow is public */}
          {isPublic && workflowId && (
            <a
              href={`/s/${workflowId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="在新标签页查看公开链接"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">公开链接</span>
            </a>
          )}

          {/* Collaboration — owner only */}
          {isOwner && workflowId && (
            <div className="relative">
              <CollaborationPopover workflowId={workflowId} isPublic={isPublic} />
            </div>
          )}

          {/* Run history — owner only */}
          {isOwner && workflowId && (
            <RunHistoryPopover workflowId={workflowId} />
          )}

          {/* Collaborator avatars — Figma-style stack */}
          {workflowId && (
            <CollaboratorAvatars workflowId={workflowId} />
          )}

          {/* Save status indicator */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
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
        </div>
      </div>

      {/* ─── Canvas + Right Panel ─── */}
      <div className={`flex flex-1 overflow-hidden min-h-0 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="relative flex-1 overflow-hidden">
          {children}
        </div>
        <RightPanel />
      </div>
    </div>
  );
}
