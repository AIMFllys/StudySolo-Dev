'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { History, Loader2, ExternalLink, Share2, Clock, Hash } from 'lucide-react';
import { fetchWorkflowRuns } from '@/services/memory.service';
import type { WorkflowRunMeta } from '@/types/memory';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('zh-CN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_DOT: Record<string, string> = {
  completed: 'bg-emerald-500',
  failed: 'bg-rose-500',
  running: 'bg-sky-500 animate-pulse',
};

export default function RunHistoryPopover({ workflowId }: { workflowId: string }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<WorkflowRunMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWorkflowRuns(workflowId);
      setRuns(data);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="运行日志"
      >
        <History className="h-3 w-3" />
        <span className="hidden sm:inline">运行日志</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-[80] w-80 max-h-[400px] overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/40 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold font-serif text-foreground">运行历史</span>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : '刷新'}
            </button>
          </div>

          <div className="overflow-y-auto max-h-[340px] scrollbar-hide">
            {loading && runs.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[11px] text-muted-foreground">暂无运行记录</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">执行工作流后，运行记录将出现在此处</p>
              </div>
            ) : (
              <div className="p-1.5 space-y-1">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => window.open(`/m/${run.id}`, '_blank', 'noopener')}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted/60 transition-colors group"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[run.status] ?? 'bg-slate-400'}`} />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDate(run.started_at)}
                      </div>
                      {run.input && (
                        <p className="text-[10px] text-foreground/80 truncate">{run.input}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {run.is_shared && (
                        <Share2 className="h-2.5 w-2.5 text-emerald-500" />
                      )}
                      <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
                        <Hash className="h-2.5 w-2.5" />
                        {run.tokens_used?.toLocaleString() ?? '0'}
                      </span>
                      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
