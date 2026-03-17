'use client';

import { createElement, memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Loader2 } from 'lucide-react';
import type { AIStepNodeData } from '@/types';
import { getNodePreview, getNodeTypeMeta, getStatusMeta } from '@/features/workflow/constants/workflow-meta';
import { getRenderer } from './index';

function AIStepNode({ data, selected, type }: NodeProps) {
  const nodeData = data as unknown as AIStepNodeData;
  const { error, label, model_route, output, output_format, status } = nodeData;
  const nodeType = nodeData.type ?? type ?? 'chat_response';
  const typeMeta = getNodeTypeMeta(nodeType);
  const statusMeta = getStatusMeta(status);
  const preview = getNodePreview(output, status === 'running' ? '正在持续生成内容...' : '等待上游节点触发');
  const [copied, setCopied] = useState(false);
  const isActive = status === 'running' || selected;
  const cardClass = isActive ? 'glass-active' : 'glass-card';

  const handleCopy = async () => {
    if (!output || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [fromClass, toClass] = typeMeta.accentClassName.split(' ');

  return (
    <div
      className={`${cardClass} relative w-[19rem] overflow-hidden rounded-2xl border border-white/10`}
      role="article"
      aria-label={`节点: ${label}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${fromClass} ${toClass}`} />

      <Handle
        type="target"
        position={Position.Left}
        className="!h-3.5 !w-3.5 !-left-2 !border-[3px] !border-slate-950/70 !bg-sky-300 !shadow-[0_0_12px_rgba(125,211,252,0.8)]"
      />

      <div className="flex items-start gap-3 border-b border-white/8 px-4 pb-3 pt-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ${typeMeta.accentClassName}`}>
          <typeMeta.icon className="h-5 w-5 text-stone-900" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-[11px] text-muted-foreground">{typeMeta.description}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${statusMeta.badgeClassName}`}>
              {statusMeta.label}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusMeta.dotClassName}`} />
            <span>{typeMeta.label}</span>
            {model_route ? (
              <span className="truncate rounded-full bg-black/10 px-2 py-0.5 normal-case">{model_route}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2.5">
          <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>输出预览</span>
            {status === 'running' ? (
              <span className="flex items-center gap-1 text-sky-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Streaming
              </span>
            ) : null}
          </div>

          {output || status === 'running' ? (
            <div className="max-h-56 overflow-y-auto">
              {createElement(getRenderer(nodeType), {
                output: output || '',
                format: output_format || 'markdown',
                nodeType,
                isStreaming: status === 'running',
              })}
            </div>
          ) : (
            <p className="line-clamp-4 text-xs leading-6 text-muted-foreground">{preview}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/8 px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="truncate">{preview}</span>
        {status === 'done' && output ? (
          <button
            onClick={() => void handleCopy()}
            className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
            aria-label="复制输出内容"
          >
            {copied ? '已复制' : '复制结果'}
          </button>
        ) : null}
      </div>

      {status === 'error' ? (
        <div className="border-t border-rose-400/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-200">
          {error || '执行失败，请检查配置或重试当前节点'}
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white/[0.035] to-transparent" />

      <Handle
        type="source"
        position={Position.Right}
        className="!h-3.5 !w-3.5 !-right-2 !border-[3px] !border-slate-950/70 !bg-violet-300 !shadow-[0_0_12px_rgba(196,181,253,0.8)]"
      />
    </div>
  );
}

export default memo(AIStepNode);
