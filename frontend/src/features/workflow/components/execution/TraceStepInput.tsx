'use client';

import { useMemo } from 'react';
import type { NodeExecutionTrace } from '@/types';

interface TraceStepInputProps {
  trace: NodeExecutionTrace;
  nodeNameMap: Record<string, string>;
}

export function TraceStepInput({ trace, nodeNameMap }: TraceStepInputProps) {
  const parsed = useMemo(() => {
    if (!trace.rawInputSnapshot) {
      return null;
    }
    try {
      return JSON.parse(trace.rawInputSnapshot) as {
        user_content?: string;
        upstream_outputs?: Record<string, unknown>;
        node_config?: Record<string, unknown>;
      };
    } catch {
      return null;
    }
  }, [trace.rawInputSnapshot]);

  if (!parsed && !trace.rawInputSnapshot) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Input</div>

      {parsed?.user_content && (
        <div className="rounded-md border border-black/5 bg-black/5 p-2 text-xs leading-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">任务描述</div>
          <div>{parsed.user_content}</div>
        </div>
      )}

      {Object.entries(parsed?.upstream_outputs ?? {}).map(([nodeId, value]) => (
        <div key={nodeId} className="rounded-md border border-black/5 bg-black/5 p-2 text-xs leading-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">{nodeNameMap[nodeId] ?? nodeId}</div>
          <div>{String(value).slice(0, 300)}{String(value).length > 300 ? '…' : ''}</div>
        </div>
      ))}

      {parsed?.node_config && Object.keys(parsed.node_config).length > 0 && (
        <div className="rounded-md border border-black/5 bg-black/5 p-2 text-xs leading-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">配置参数</div>
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(parsed.node_config, null, 2)}</pre>
        </div>
      )}

      {!parsed && trace.rawInputSnapshot && (
        <div className="rounded-md border border-black/5 bg-black/5 p-2 text-xs leading-5 dark:border-white/10 dark:bg-white/5">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">原始输入</div>
          <pre className="whitespace-pre-wrap break-words">{trace.rawInputSnapshot}</pre>
        </div>
      )}
    </div>
  );
}
