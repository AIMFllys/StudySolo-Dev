'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkflowExecutionSession } from '@/types';
import { TraceParallelGroup } from '@/features/workflow/components/execution/TraceParallelGroup';
import { TraceStepItem } from '@/features/workflow/components/execution/TraceStepItem';
import {
  buildTraceListItems,
  filterTracesByChain,
  shouldShowChainTabs,
} from '@/features/workflow/components/execution/trace-list-utils';

interface ExecutionTraceListProps {
  session: WorkflowExecutionSession;
  nodeNameMap: Record<string, string>;
  embedded?: boolean;
}

export function ExecutionTraceList({ session, nodeNameMap, embedded = false }: ExecutionTraceListProps) {
  const [activeChainId, setActiveChainId] = useState<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setActiveChainId(null);
    });
  }, [session.sessionId]);

  const filteredTraces = useMemo(() => {
    return filterTracesByChain(session.traces, activeChainId);
  }, [activeChainId, session.traces]);

  const items = useMemo(() => buildTraceListItems(filteredTraces), [filteredTraces]);
  const hasMultipleChains = shouldShowChainTabs(session.chains);

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-4 p-4'}>
      {hasMultipleChains ? (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            type="button"
            onClick={() => setActiveChainId(null)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
              activeChainId === null
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            全部
          </button>
          {(session.chains ?? []).map((chain) => (
            <button
              key={chain.chainId}
              type="button"
              onClick={() => setActiveChainId(chain.chainId)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
                activeChainId === chain.chainId
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {chain.label}
            </button>
          ))}
        </div>
      ) : null}
      {items.map((item, index) => (
        item.kind === 'parallel'
          ? <TraceParallelGroup key={`parallel-${index}`} traces={item.traces} nodeNameMap={nodeNameMap} />
          : <TraceStepItem key={item.trace.nodeId} trace={item.trace} nodeNameMap={nodeNameMap} />
      ))}
    </div>
  );
}
