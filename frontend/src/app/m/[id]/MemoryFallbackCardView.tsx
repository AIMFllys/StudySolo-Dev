'use client';

import { Clock, Zap, Hash } from 'lucide-react';
import type { WorkflowRunDetail } from '@/types/memory';
import { formatDateTime, formatDuration, computeTotalDuration, STATUS_CONFIG } from './memory-view-utils';
import { MemoryShareToggle } from './MemoryShareToggle';
import { OrphanTraceCard } from './OrphanTraceCard';

export function MemoryFallbackCardView({ run }: { run: WorkflowRunDetail }) {
  const totalDuration = computeTotalDuration(run);
  const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = statusCfg.icon;
  const doneTraces = run.traces.filter((t) => t.status === 'done');
  const errorTraces = run.traces.filter((t) => t.status === 'error');

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto max-w-4xl px-4 py-20 space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <h1 className="text-lg font-bold font-serif text-foreground truncate">{run.workflow_name}</h1>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono flex-wrap">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDateTime(run.started_at)}</span>
                {totalDuration !== null && (
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" />总耗时 {formatDuration(totalDuration)}</span>
                )}
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" />Token {run.tokens_used?.toLocaleString() ?? '0'}</span>
              </div>
            </div>
            <div className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium ${statusCfg.className}`}>
              <StatusIcon className={`h-3.5 w-3.5 ${run.status === 'running' ? 'animate-spin' : ''}`} />
              {statusCfg.label}
            </div>
          </div>
          <div className="flex items-center gap-4 pt-2 border-t border-dashed border-border/40">
            <span className="text-[10px] text-muted-foreground">{doneTraces.length} 个节点完成</span>
            {errorTraces.length > 0 && <span className="text-[10px] text-rose-600 dark:text-rose-400">{errorTraces.length} 个节点出错</span>}
            <span className="text-[10px] text-muted-foreground">共 {run.traces.length} 个节点</span>
            <div className="flex-1" />
            <MemoryShareToggle runId={run.id} initialShared={run.is_shared} />
          </div>
        </div>

        {run.traces.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">该运行记录暂无详细节点数据</p>
          </div>
        ) : (
          <div className="space-y-3">
            {run.traces.map((trace, i) => (
              <OrphanTraceCard key={trace.id} trace={trace} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
