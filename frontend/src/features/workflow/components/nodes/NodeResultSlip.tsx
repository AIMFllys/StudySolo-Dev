import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Loader2, Clock3 } from 'lucide-react';
import { NodeStatus } from '@/types';
import { getRenderer } from './index';

interface NodeResultSlipProps {
  nodeId: string;
  status: NodeStatus;
  output: string;
  error?: string;
  inputSnapshot?: string;
  nodeType: string;
  outputFormat?: string;
  executionTimeMs?: number;
}

// Parse and format the raw JSON input snapshot into readable sections
function parseInputSnapshot(raw: string | undefined): {
  userContent?: string;
  upstreamOutputs?: Record<string, string>;
  nodeConfig?: unknown;
} | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      userContent: parsed.user_content,
      upstreamOutputs: parsed.upstream_outputs,
      nodeConfig: parsed.node_config,
    };
  } catch {
    return null;
  }
}

export const NodeResultSlip: React.FC<NodeResultSlipProps> = ({
  nodeId,
  status,
  output,
  error,
  inputSnapshot,
  nodeType,
  outputFormat = 'markdown',
  executionTimeMs,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const parsedInput = useMemo(() => parseInputSnapshot(inputSnapshot), [inputSnapshot]);

  // ── Pending: show a silent "idle" tab — never return null ──────────────────
  if (!status || status === 'pending') {
    return (
      <div className="node-result-slip mt-1 w-full bg-black/[0.02] dark:bg-white/[0.02] border-t border-dashed border-black/8 dark:border-white/8 rounded-b-md nodrag">
        <div className="flex items-center gap-2 px-3 py-1.5 pointer-events-none select-none">
          <Clock3 className="w-3 h-3 text-black/20 dark:text-white/20" />
          <span className="font-mono text-[10px] text-black/20 dark:text-white/20 tracking-wider">
            闲置中
          </span>
        </div>
      </div>
    );
  }

  const Renderer = getRenderer(nodeType);
  const timeStr = executionTimeMs ? `${(executionTimeMs / 1000).toFixed(1)}s` : '';

  let StatusIcon = Loader2;
  let statusText = '执行中...';
  let iconClass = 'animate-spin text-sky-500';

  if (status === 'done') {
    StatusIcon = CheckCircle2;
    statusText = `运行成功  ${timeStr}`;
    iconClass = 'text-emerald-500';
  } else if (status === 'error') {
    StatusIcon = AlertCircle;
    statusText = '执行失败';
    iconClass = 'text-rose-500';
  } else if (status === 'waiting') {
    StatusIcon = Loader2;
    statusText = '等待中...';
    iconClass = 'text-amber-500 opacity-70';
  } else if (status === 'skipped') {
    StatusIcon = CheckCircle2;
    statusText = '已跳过';
    iconClass = 'text-stone-400';
  }

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  };

  const hasInput = parsedInput && (
    parsedInput.userContent ||
    (parsedInput.upstreamOutputs && Object.keys(parsedInput.upstreamOutputs).length > 0)
  );

  return (
    <div className="node-result-slip mt-1 w-full rounded-b-md overflow-hidden bg-black/[0.03] dark:bg-white/[0.03] shadow-[inset_0_3px_8px_-4px_rgba(0,0,0,0.06)] border-t border-dashed border-black/10 dark:border-white/10 nodrag relative z-50">
      <div
        className="flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-3.5 h-3.5 ${iconClass}`} />
          <span className="font-mono text-[11px] text-black/60 dark:text-white/60">
            {statusText}
          </span>
        </div>
        <div className="text-black/40 dark:text-white/40">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden bg-white/50 dark:bg-black/20"
          >
            <div
              className="px-3 pb-3 max-h-[400px] overflow-y-auto w-full custom-scrollbar cursor-text relative z-50"
              onWheel={(e) => e.stopPropagation()}
            >
              {/* ── Input Section ── */}
              {hasInput && (
                <div className="mb-3 pt-2 space-y-2">
                  <div className="text-[10px] font-bold text-black/40 dark:text-white/40 uppercase tracking-wider">
                    Input
                  </div>

                  {parsedInput!.userContent && (
                    <div>
                      <span className="font-mono text-[9px] text-black/30 dark:text-white/30 uppercase tracking-widest">任务描述</span>
                      <pre className="mt-0.5 font-mono text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5 text-black/70 dark:text-white/70 whitespace-pre-wrap break-words">
                        {parsedInput!.userContent}
                      </pre>
                    </div>
                  )}

                  {parsedInput!.upstreamOutputs && Object.keys(parsedInput!.upstreamOutputs).length > 0 && (
                    <div>
                      <span className="font-mono text-[9px] text-black/30 dark:text-white/30 uppercase tracking-widest">上游输入</span>
                      <div className="mt-0.5 space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                        {Object.entries(parsedInput!.upstreamOutputs).map(([uid, val]) => (
                          <pre key={uid} className="font-mono text-[10px] bg-black/5 dark:bg-white/5 p-2 rounded border border-black/5 dark:border-white/5 text-black/70 dark:text-white/70 whitespace-pre-wrap break-words">
                            <span className="text-black/30 dark:text-white/30">[{uid.slice(0, 6)}]</span>{' '}
                            {String(val).slice(0, 500)}{String(val).length > 500 ? '…' : ''}
                          </pre>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Divider ── */}
              {hasInput && (output || error) && (
                <div className="border-t border-dashed border-black/10 dark:border-white/10 my-3" />
              )}

              {/* ── Output Section ── */}
              {(output || error) ? (
                <>
                  <div className="text-[10px] font-bold text-black/40 dark:text-white/40 mb-1 uppercase tracking-wider">Output</div>
                  {status === 'error' && error ? (
                    <div className="text-rose-500 font-mono text-[11px] bg-rose-500/10 border border-rose-500/20 p-2 rounded whitespace-pre-wrap break-all">
                      {error}
                    </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
