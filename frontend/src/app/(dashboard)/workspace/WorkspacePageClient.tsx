'use client';

import { Plus } from 'lucide-react';
import { useCreateWorkflowAction } from '@/features/workflow/hooks/use-create-workflow-action';
import type { WorkflowMeta } from '@/types/workflow';
import type { UserWorkflowQuota } from '@/services/workflow.server.service';
import WorkflowList from './WorkflowList';
import WorkspaceCapacityBadge from './WorkspaceCapacityBadge';

interface WorkspacePageClientProps {
  initialWorkflows: WorkflowMeta[];
  quota: UserWorkflowQuota;
}

export default function WorkspacePageClient({ initialWorkflows, quota }: WorkspacePageClientProps) {
  const { creating, createWorkflow } = useCreateWorkflowAction();
  const isFull = quota.workflows_remaining <= 0;

  return (
    <div className="p-8 max-w-[1400px] mx-auto flex flex-col gap-6 lg:p-10">
      {/* 顶部 Banner — 纸质风格 */}
      <div className="relative z-20 rounded-[1.5rem] bg-[#fbfaf8] dark:bg-card border border-black/[0.06] dark:border-border p-7 md:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,1),_0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-none mb-4">
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#f0eee9]/40 dark:from-white/5 to-transparent pointer-events-none rounded-b-[1.5rem]" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          {/* 左侧标题 */}
          <div className="flex items-end gap-6 relative w-fit">
            <h1 className="text-3xl font-serif text-slate-800 dark:text-slate-200 tracking-wider font-medium flex items-center relative pb-1">
              我的工作流
              <div className="hidden sm:block absolute bottom-0 left-0 w-full h-[5px] bg-[#dce1e9]/60 dark:bg-slate-600/30 mix-blend-multiply dark:mix-blend-normal rounded-full" />
            </h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-medium tracking-wide whitespace-nowrap mb-[5px]">
              设计、管理和发布属于你的学习蓝图
            </p>
          </div>

          {/* 右侧：容量 Badge + 新建按钮 */}
          <div className="flex items-center gap-4 pl-4 pt-6 md:pt-0">
            {/* 可点击容量面板 (Client Component) */}
            <WorkspaceCapacityBadge quota={quota} />

            <button
              onClick={() => void createWorkflow()}
              disabled={isFull || creating}
              className={`group flex h-9 items-center justify-center gap-2 rounded-full px-5 font-medium shadow-sm ring-1 ring-black/10 dark:ring-white/10 transition-all text-[13px] ${
                isFull || creating
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 dark:hover:bg-slate-600 hover:shadow-md dark:shadow-none hover:-translate-y-[1px] active:translate-y-[0px]'
              }`}
              aria-label={creating ? '创建中...' : '新建工作流'}
            >
              <Plus className={`h-4 w-4 opacity-80 transition-transform ${creating ? 'animate-spin' : 'group-hover:rotate-90'}`} />
              {creating ? '创建中...' : '新建工作流'}
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 w-full">
        <WorkflowList initialWorkflows={initialWorkflows} remaining={quota.workflows_remaining} />
      </div>
    </div>
  );
}
