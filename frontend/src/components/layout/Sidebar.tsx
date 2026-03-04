'use client';

import Link from 'next/link';
import { useSidebarNavigation } from '@/hooks/use-sidebar-navigation';
import { useWorkflowContextMenu } from '@/hooks/use-workflow-context-menu';
import { useWorkflowSidebarActions } from '@/hooks/use-workflow-sidebar-actions';
import { SidebarContextMenu } from './sidebar/SidebarContextMenu';
import { SidebarWorkflowItem } from './sidebar/SidebarWorkflowItem';

export interface WorkflowMeta {
  id: string;
  name: string;
  updated_at: string;
  isRunning?: boolean;
}

interface SidebarProps {
  workflows: WorkflowMeta[];
}

export default function Sidebar({ workflows }: SidebarProps) {
  const { pathname, settingsActive, knowledgeActive, isWorkflowActive, logoutAndRedirect } =
    useSidebarNavigation();
  const { contextMenu, handleContextMenu, closeContextMenu } =
    useWorkflowContextMenu();
  const { processingWorkflowId, onRenameWorkflow, onDeleteWorkflow } =
    useWorkflowSidebarActions(pathname, closeContextMenu);

  function handleRename(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    void onRenameWorkflow(workflowId, workflow?.name ?? '未命名工作流');
  }

  function handleDelete(workflowId: string) {
    const workflow = workflows.find((item) => item.id === workflowId);
    void onDeleteWorkflow(workflowId, workflow?.name ?? '未命名工作流');
  }

  return (
    <>
      <aside className="flex h-full w-16 shrink-0 flex-col border-r border-border bg-background transition-all duration-200 lg:w-[280px]">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="shrink-0 text-primary"
          >
            <rect
              x="2"
              y="2"
              width="16"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M6 7h8M6 10h5M6 13h6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:block">
            工作流
          </span>
        </div>

        <nav className="scrollbar-hide flex-1 overflow-y-auto py-2">
          {workflows.length === 0 ? (
            <p className="hidden px-4 py-3 text-xs text-muted-foreground lg:block">
              暂无工作流
            </p>
          ) : null}
          {workflows.map((workflow) => (
            <SidebarWorkflowItem
              key={workflow.id}
              workflow={workflow}
              active={isWorkflowActive(workflow.id)}
              onContextMenu={handleContextMenu}
            />
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-border p-2">
          <Link
            href="/knowledge"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${knowledgeActive
              ? 'bg-white/5 text-foreground'
              : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="shrink-0"
            >
              <path
                d="M2.25 3.75h4.5a1.5 1.5 0 011.5 1.5V15a1.125 1.125 0 00-1.125-1.125h-4.5A.375.375 0 012.25 13.5V3.75zM15.75 3.75h-4.5a1.5 1.5 0 00-1.5 1.5V15a1.125 1.125 0 011.125-1.125h4.5a.375.375 0 00.375-.375V3.75z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden text-sm lg:block">知识库</span>
          </Link>

          <Link
            href="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${settingsActive
              ? 'bg-white/5 text-foreground'
              : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="shrink-0"
            >
              <circle
                cx="9"
                cy="9"
                r="2.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M9 2v1.5M9 14.5V16M2 9h1.5M14.5 9H16M3.87 3.87l1.06 1.06M13.07 13.07l1.06 1.06M3.87 14.13l1.06-1.06M13.07 4.93l1.06-1.06"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span className="hidden text-sm lg:block">设置</span>
          </Link>

          <button
            onClick={() => {
              void logoutAndRedirect();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              className="shrink-0"
            >
              <path
                d="M6.75 15.75H3.75a1.5 1.5 0 01-1.5-1.5V3.75a1.5 1.5 0 011.5-1.5h3M12 12.75L15.75 9 12 5.25M6.75 9h9"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden text-sm lg:block">退出登录</span>
          </button>
        </div>
      </aside>

      {contextMenu ? (
        <SidebarContextMenu
          contextMenu={contextMenu}
          processingWorkflowId={processingWorkflowId}
          onClose={closeContextMenu}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : null}
    </>
  );
}
