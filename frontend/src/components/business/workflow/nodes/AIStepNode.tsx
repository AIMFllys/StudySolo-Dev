'use client';

import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import NodeMarkdownOutput from './NodeMarkdownOutput';
import type { AIStepNodeData } from '@/types';

/** Status badge config: [bgClass, textClass, label] */
const STATUS_CONFIG: Record<string, [string, string, string]> = {
  pending: ['bg-white/5', 'text-slate-400', '等待中'],
  running: ['bg-primary/20', 'text-primary', '运行中'],
  done: ['bg-accent/10', 'text-accent', '完成'],
  error: ['bg-red-500/10', 'text-red-400', '错误'],
  paused: ['bg-white/5', 'text-slate-400', '暂停'],
};

/** Node card border class by status */
const STATUS_BORDER: Record<string, string> = {
  pending: 'border-white/5',
  running: 'border-primary/40 animate-border-pulse',
  done: 'border-accent/30',
  error: 'border-red-500/30',
  paused: 'border-white/5',
};

function AIStepNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AIStepNodeData;
  const { label, status, output } = nodeData;
  const [copied, setCopied] = useState(false);

  const isActive = status === 'running' || selected;
  const cardClass = isActive ? 'glass-active' : 'glass-card';
  const borderClass = STATUS_BORDER[status] ?? 'border-white/5';
  const [badgeBg, badgeText, badgeLabel] = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`${cardClass} border ${borderClass} rounded-xl w-64`}
      role="article"
      aria-label={`节点: ${label}`}
    >
      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !rounded-full !bg-slate-600 hover:!bg-primary !border-0 !-left-1.5"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          {status === 'running' && (
            <span className="material-symbols-outlined text-sm text-primary animate-spin">
              progress_activity
            </span>
          )}
          <span className="text-xs font-medium truncate text-[var(--ss-text-main)]">
            {label}
          </span>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badgeBg} ${badgeText}`}>
          {badgeLabel}
        </span>
      </div>

      {/* Output area */}
      {(output || status === 'running') && (
        <div className="px-3 py-2 overflow-y-auto" style={{ maxHeight: 200 }}>
          {output ? (
            <NodeMarkdownOutput content={output} streaming={status === 'running'} />
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-primary">
              <span className="animate-pulse">●</span>
              <span className="animate-pulse" style={{ animationDelay: '150ms' }}>●</span>
              <span className="animate-pulse" style={{ animationDelay: '300ms' }}>●</span>
            </div>
          )}
        </div>
      )}

      {/* Copy button for completed nodes */}
      {status === 'done' && output && (
        <div className="px-3 py-1.5 border-t border-white/5">
          <button
            onClick={handleCopy}
            className="text-[10px] text-[var(--ss-text-muted)] hover:text-[var(--ss-text-main)] transition-colors"
            aria-label="复制输出内容"
          >
            {copied ? '✓ 已复制' : '复制'}
          </button>
        </div>
      )}

      {/* Error message */}
      {status === 'error' && (
        <div className="px-3 py-2 text-xs text-red-400">
          执行失败，请检查配置后重试
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !rounded-full !bg-slate-600 hover:!bg-primary !border-0 !-right-1.5"
      />
    </div>
  );
}

export default memo(AIStepNode);
