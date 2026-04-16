'use client';

import { useMemo, useState } from 'react';
import type { NodeExecutionTrace } from '@/types';
import { STATUS_META } from '@/features/workflow/constants/workflow-meta';
import { formatDuration } from '@/features/workflow/utils/trace-helpers';
import { TraceStepInput } from '@/features/workflow/components/execution/TraceStepInput';
import { TraceStepOutput } from '@/features/workflow/components/execution/TraceStepOutput';

interface TraceStepItemProps {
  trace: NodeExecutionTrace;
  nodeNameMap: Record<string, string>;
}

export function TraceStepItem({ trace, nodeNameMap }: TraceStepItemProps) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const isExpanded = trace.status === 'running' || trace.status === 'error' || manualExpanded;

  const badge = STATUS_META[trace.status];
  const duration = useMemo(() => (
    trace.durationMs ? formatDuration(trace.durationMs) : ''
  ), [trace.durationMs]);
  const timelineClassName = trace.status === 'done'
    ? 'border-emerald-500/50 border-solid'
    : trace.status === 'running'
      ? 'border-sky-500/60 border-dashed'
      : trace.status === 'skipped'
        ? 'border-black/5 border-dashed opacity-60 dark:border-white/5'
        : 'border-black/10 border-dashed dark:border-white/10';
  const dotClassName = trace.status === 'running'
    ? `${badge.dotClassName} animate-pulse shadow-[0_0_0_6px_rgba(56,189,248,0.12)]`
    : badge.dotClassName;
  const titleClassName = trace.status === 'skipped'
    ? 'mt-1 text-sm font-medium text-foreground line-through decoration-muted-foreground/60'
    : 'mt-1 text-sm font-medium text-foreground';
  const summaryClassName = trace.status === 'skipped'
    ? 'mt-1 text-xs leading-5 text-muted-foreground line-through decoration-muted-foreground/60'
    : 'mt-1 text-xs leading-5 text-muted-foreground';
  const progressClassName = trace.status === 'error'
    ? 'mt-2 text-xs leading-5 text-rose-500'
    : 'mt-2 text-xs leading-5 text-primary';

  return (
    <div className={`relative border-l pl-5 ${timelineClassName}`}>
      <div className={`absolute -left-[5px] top-2 h-[10px] w-[10px] rounded-full ${dotClassName}`} />

      <div className="pb-5">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              步骤 {trace.executionOrder}
            </div>
            <div className={titleClassName}>
              <span className="mr-2 text-muted-foreground">→</span>
              <span className="break-words">{trace.nodeName}</span>
            </div>
            {trace.inputSummary && (
              <div className={summaryClassName}>{trace.inputSummary}</div>
            )}
            {typeof trace.iteration === 'number' ? (
              <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                循环第 {trace.iteration} 轮
              </div>
            ) : null}
            {trace.progressMessage ? (
              <div className={progressClassName}>{trace.progressMessage}</div>
            ) : null}
            {trace.chainIds && trace.chainIds.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                {trace.chainIds.map((chainId) => (
                  <span key={chainId}>线路 {chainId}</span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {duration ? <span className="text-[10px] text-muted-foreground whitespace-nowrap">{duration}</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap ${badge.badgeClassName}`}>{badge.label}</span>
          </div>
        </div>

        {(trace.status === 'running' || trace.status === 'error' || isExpanded) && (
          <div className="space-y-3 rounded-lg border border-black/5 bg-background/70 p-3 dark:border-white/10">
            <TraceStepInput trace={trace} nodeNameMap={nodeNameMap} />
            <div className="border-t border-dashed border-black/10 dark:border-white/10" />
            <TraceStepOutput trace={trace} compact={!isExpanded && trace.status !== 'running'} />
          </div>
        )}

        {trace.status === 'done' && (
          <button
            type="button"
            onClick={() => setManualExpanded((prev) => !prev)}
            className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {isExpanded ? '收起 Input / Output' : '查看 Input / Output'}
          </button>
        )}
      </div>
    </div>
  );
}
