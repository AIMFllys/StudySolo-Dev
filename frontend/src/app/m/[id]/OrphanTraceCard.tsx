'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Timer } from 'lucide-react';
import type { RunTrace } from '@/types/memory';
import { formatDuration, getNodeMeta } from './memory-view-utils';

export function OrphanTraceCard({ trace, index }: { trace: RunTrace; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getNodeMeta(trace.node_type);
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-border/60 bg-background/95 backdrop-blur-md shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[9px] font-bold font-mono text-muted-foreground">
          {index + 1}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
        <span className="text-[11px] font-semibold font-serif text-foreground truncate flex-1">
          {trace.node_name}
        </span>
        {trace.duration_ms !== null && (
          <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground font-mono">
            <Timer className="h-2.5 w-2.5" />
            {formatDuration(trace.duration_ms)}
          </span>
        )}
        {trace.status === 'error' && <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />}
        {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {expanded && trace.final_output && (
        <div className="border-t border-border/40 px-3 py-2">
          <p className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto scrollbar-hide">
            {trace.final_output.slice(0, 1000)}{trace.final_output.length > 1000 ? '…' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
