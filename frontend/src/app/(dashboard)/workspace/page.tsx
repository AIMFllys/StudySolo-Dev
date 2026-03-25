import { fetchWorkflowListForServer } from '@/services/workflow.server.service';
import WorkflowList from './WorkflowList';
import { Layers, Plus } from 'lucide-react';

export default async function WorkspacePage() {
  const workflows = await fetchWorkflowListForServer();
  const maxWorkflows = 10; // Default limit for free tier

  const usageRatio = workflows.length / maxWorkflows;
  const isWarnings = usageRatio >= 0.8;

  return (
    <div className="p-8 max-w-[1400px] mx-auto flex flex-col gap-6 lg:p-10">
      {/* 微微类纸风格 顶部区域 */}
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[#fbfaf8] border border-black/[0.06] p-7 md:p-8 shadow-[inset_0_1px_0_rgba(255,255,255,1),_0_2px_8px_rgba(0,0,0,0.02)] mb-4">
        {/* Paper texture subtle gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#f0eee9]/40 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          
          {/* 左侧文字与标语横向底部分组对齐 */}
          <div className="flex items-end gap-6 relative w-fit">
            <h1 className="text-3xl font-serif text-slate-800 tracking-wider font-medium flex items-center relative pb-1">
              我的工作流
              <div className="hidden sm:block absolute bottom-0 left-0 w-full h-[5px] bg-[#dce1e9]/60 mix-blend-multiply rounded-full" />
            </h1>
            <p className="text-[13px] text-slate-500 font-medium tracking-wide whitespace-nowrap mb-[5px]">
              设计、管理和发布属于你的学习蓝图
            </p>
          </div>

          {/* 右侧总量及新增按钮 */}
          <div className="flex items-center gap-4 pl-4 pt-6 md:pt-0">
            <div className="flex items-center gap-2.5 rounded-full bg-white/80 backdrop-blur-sm px-4 py-2 border border-black/5 shadow-sm">
              <Layers className={`h-4 w-4 ${isWarnings ? 'text-amber-500' : 'text-slate-400'}`} />
              <div className="flex items-baseline gap-1">
                 <span className="text-sm font-semibold text-slate-700">{workflows.length}</span>
                 <span className="text-[11px] font-medium text-slate-400">/ {maxWorkflows} 容量</span>
              </div>
            </div>
            
            <a
              href="/workspace/new"
              className="group flex h-9 items-center justify-center gap-2 rounded-full bg-slate-800 px-5 font-medium text-white shadow-sm ring-1 ring-black/10 transition-all hover:bg-slate-900 hover:shadow-md hover:-translate-y-[1px] active:translate-y-[0px] text-[13px]"
            >
              <Plus className="h-4 w-4 opacity-80 transition-transform group-hover:rotate-90" />
              新建工作流
            </a>
          </div>
        </div>
      </div>
      
      <div className="relative z-10 w-full">
        <WorkflowList initialWorkflows={workflows} />
      </div>
    </div>
  );
}

