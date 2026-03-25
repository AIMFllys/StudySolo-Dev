'use client';

import Link from 'next/link';
import { formatMonthDay } from '@/utils/date';
import type { WorkflowMeta } from '../Sidebar';

interface SidebarWorkflowItemProps {
  workflow: WorkflowMeta;
  active: boolean;
  onContextMenu: (event: React.MouseEvent, workflowId: string) => void;
  isEditing?: boolean;
  onRenameSubmit?: (id: string, newName: string) => void;
  onCancelEdit?: () => void;
}

export function SidebarWorkflowItem({
  workflow,
  active,
  onContextMenu,
  isEditing,
  onRenameSubmit,
  onCancelEdit,
}: SidebarWorkflowItemProps) {
  return (
    <div
      className={`group relative mx-2 my-1 flex items-center gap-2.5 rounded-none px-3 py-2 transition-all duration-200 border-[1.5px] ${
        active
          ? 'paper-active'
          : 'border-transparent text-muted-foreground hover:bg-surface-hover hover:text-text-main'
      }`}
    >
      <Link
        href={`/workspace/${workflow.id}`}
        onContextMenu={(event) => onContextMenu(event, workflow.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 outline-none"
      >
        <span className="relative shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="text-current"
          >
            <rect
              x="1.5"
              y="1.5"
              width="13"
              height="13"
              rx="2.5"
              stroke="currentColor"
              strokeWidth="1.5"
              style={{ strokeLinecap: 'round', strokeLinejoin: 'round' }}
            />
            <path
              d="M4.5 5.5h7M4.5 8h5M4.5 10.5h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {workflow.isRunning ? (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-accent" />
          ) : null}
        </span>

        <div className="hidden min-w-0 flex-1 lg:block">
          {isEditing ? (
            <input
              autoFocus
              defaultValue={workflow.name}
              className="w-full text-sm font-medium leading-tight text-foreground bg-background border-b border-primary/40 outline-none px-1 py-0.5 mb-1"
              onBlur={(e) => onRenameSubmit?.(workflow.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameSubmit?.(workflow.id, e.currentTarget.value);
                if (e.key === 'Escape') onCancelEdit?.();
              }}
              onClick={(e) => e.preventDefault()}
            />
          ) : (
            <p className={`truncate text-sm font-medium leading-tight transition-colors ${active ? 'text-primary' : 'text-foreground group-hover:text-foreground'}`}>{workflow.name}</p>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatMonthDay(workflow.updated_at, 'zh-CN')}
          </p>
        </div>
      </Link>

      <div className="hidden lg:flex shrink-0 items-center justify-center z-10">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Run workflow', workflow.id);
          }}
          className={`flex h-6 w-6 items-center justify-center rounded-sm transition-colors ${
            active 
              ? 'text-primary hover:bg-primary/10' 
              : 'text-muted-foreground hover:bg-surface-hover/80 hover:text-text-main'
          }`}
          title="运行工作流"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
}
