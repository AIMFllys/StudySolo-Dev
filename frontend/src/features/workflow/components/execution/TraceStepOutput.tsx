'use client';

import type { NodeExecutionTrace } from '@/types';
import { getRenderer } from '@/features/workflow/components/nodes';

interface TraceStepOutputProps {
  trace: NodeExecutionTrace;
  compact: boolean;
}

export function TraceStepOutput({ trace, compact }: TraceStepOutputProps) {
  const Renderer = getRenderer(trace.nodeType);
  const output = trace.status === 'running'
    ? trace.streamingOutput
    : (trace.finalOutput ?? trace.streamingOutput);

  if (trace.errorMessage) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs leading-5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
        {trace.errorMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Output</div>
      <div className="rounded-md border border-black/5 bg-black/5 p-2 dark:border-white/10 dark:bg-white/5">
        <Renderer
          output={output}
          format={trace.outputFormat ?? 'markdown'}
          nodeType={trace.nodeType}
          isStreaming={trace.status === 'running'}
          compact={compact}
        />
      </div>
    </div>
  );
}
