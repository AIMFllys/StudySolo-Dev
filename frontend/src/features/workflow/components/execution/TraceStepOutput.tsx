'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { NodeExecutionTrace } from '@/types';
import { resolveRenderer } from '@/features/workflow/components/nodes';
import { useNodeManifestItem } from '@/features/workflow/hooks/use-node-manifest';

interface TraceStepOutputProps {
  trace: NodeExecutionTrace;
  compact: boolean;
}

/** Max collapsed height in px before showing "展开全部" */
const OUTPUT_COLLAPSED_MAX_H = 400;

export function TraceStepOutput({ trace, compact }: TraceStepOutputProps) {
  const { manifestItem } = useNodeManifestItem(trace.nodeType);
  const Renderer = useMemo(
    () =>
      resolveRenderer({
        nodeType: trace.nodeType,
        rendererName: manifestItem?.renderer,
      }),
    [manifestItem?.renderer, trace.nodeType],
  );
  const output = trace.status === 'running'
    ? trace.streamingOutput
    : (trace.finalOutput ?? trace.streamingOutput);
  const [expanded, setExpanded] = useState(false);

  if (trace.errorMessage) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs leading-5 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
        {trace.errorMessage}
      </div>
    );
  }

  const isStreaming = trace.status === 'running';

  return (
    <div className="space-y-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Output</div>
      <div className="relative rounded-md border border-black/5 bg-black/5 dark:border-white/10 dark:bg-white/5">
        <div
          className={`p-2 ${!expanded && !isStreaming ? 'overflow-hidden' : 'overflow-y-auto scrollbar-hide'}`}
          style={!expanded && !isStreaming ? { maxHeight: OUTPUT_COLLAPSED_MAX_H } : undefined}
        >
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Renderer
            output={output}
            format={trace.outputFormat ?? 'markdown'}
            nodeType={trace.nodeType}
            isStreaming={isStreaming}
            compact={compact}
          />
        </div>

        {/* Fade overlay + expand toggle when content overflows */}
        {!expanded && !isStreaming && (
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
            <div className="h-8 w-full bg-gradient-to-t from-black/5 to-transparent dark:from-white/5 pointer-events-none" />
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm border border-border/40 shadow-sm -mt-3 mb-1"
            >
              <ChevronDown className="h-3 w-3" />
              展开全部
            </button>
          </div>
        )}

        {expanded && !isStreaming && (
          <div className="flex justify-center py-1 border-t border-border/30">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="h-3 w-3" />
              收起
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
