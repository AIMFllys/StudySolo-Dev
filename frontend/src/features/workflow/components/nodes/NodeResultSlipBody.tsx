import React from 'react';
import type { NodeStatus } from '@/types';

type ParsedInputSnapshot = {
  userContent?: string;
  upstreamOutputs?: Record<string, string>;
  nodeConfig?: unknown;
  rawText?: string;
} | null;

interface NodeResultSlipBodyProps {
  parsedInput: ParsedInputSnapshot;
  nodeNameMap: Record<string, string>;
  output: string;
  error?: string;
  status: NodeStatus;
  outputFormat: string;
  nodeType: string;
  Renderer: React.ComponentType<{
    output: string;
    format?: string;
    nodeType?: string;
    isStreaming?: boolean;
  }>;
}

export function NodeResultSlipBody({
  parsedInput,
  nodeNameMap,
  output,
  error,
  status,
  outputFormat,
  nodeType,
  Renderer,
}: NodeResultSlipBodyProps) {
  const hasInput = parsedInput && (
    parsedInput.rawText ||
    parsedInput.userContent ||
    (parsedInput.upstreamOutputs && Object.keys(parsedInput.upstreamOutputs).length > 0)
  );

  return (
    <div className="px-3 pb-3 max-h-[400px] overflow-y-auto w-full custom-scrollbar cursor-text relative z-50" onWheel={(e) => e.stopPropagation()}>
      {hasInput && (
        <div className="mb-3 pt-2 space-y-2">
          <div className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wider">Input</div>

          {parsedInput?.userContent && (
            <div>
              <span className="font-mono text-[9px] text-black/30 dark:text-white/30 uppercase tracking-widest">任务描述</span>
              <pre className="mt-0.5 font-mono text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5 text-black/70 dark:text-white/70 whitespace-pre-wrap break-words">{parsedInput.userContent}</pre>
            </div>
          )}

          {parsedInput?.upstreamOutputs && Object.keys(parsedInput.upstreamOutputs).length > 0 && (
            <div>
              <span className="font-mono text-[9px] text-black/30 dark:text-white/30 uppercase tracking-widest">上游输入</span>
              <div className="mt-0.5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                {Object.entries(parsedInput.upstreamOutputs).map(([uid, val]) => (
                  <pre key={uid} className="font-mono text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5 text-black/70 dark:text-white/70 whitespace-pre-wrap break-words">
                    <span className="text-black/30 dark:text-white/30">[{nodeNameMap[uid] ?? uid.slice(0, 6)}]</span>{' '}
                    {String(val).slice(0, 500)}{String(val).length > 500 ? '…' : ''}
                  </pre>
                ))}
              </div>
            </div>
          )}

          {parsedInput?.rawText && (
            <div>
              <span className="font-mono text-[9px] text-black/30 dark:text-white/30 uppercase tracking-widest">原始输入</span>
              <pre className="mt-0.5 font-mono text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5 text-black/70 dark:text-white/70 whitespace-pre-wrap break-words">{parsedInput.rawText}</pre>
            </div>
          )}
        </div>
      )}

      {hasInput && (output || error) && (
        <div className="border-t border-dashed border-black/10 dark:border-white/10 my-3" />
      )}

      {(output || error) ? (
        <>
          <div className="text-[10px] font-bold text-black/40 dark:text-white/40 mb-1 uppercase tracking-wider">Output</div>
          {status === 'error' && error ? (
            <div className="text-rose-500 font-mono text-[11px] bg-rose-500/10 border border-rose-500/20 p-2 rounded whitespace-pre-wrap break-all">{error}</div>
          ) : (
            <div className="text-[12px] text-black/80 dark:text-white/80 bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5">
              <Renderer
                output={output}
                format={outputFormat}
                nodeType={nodeType}
                isStreaming={status === 'running'}
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
