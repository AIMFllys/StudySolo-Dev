'use client';

/**
 * TriggerInputNode — 工作流入口输入节点
 *
 * 与 AIStepNode 不同，此节点在卡片内部提供可编辑 textarea，
 * 让用户在画布上直接输入/修改学习目标，无需打开任何弹窗。
 *
 * 数据存储：node.data.user_content（执行引擎读取此字段）
 * 同步：编辑时实时更新 node.data.label（节点显示名称）
 */

import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Play, Settings2 } from 'lucide-react';
import type { AIStepNodeData } from '@/types';
import { getNodeTheme } from '@/features/workflow/constants/workflow-meta';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { eventBus } from '@/lib/events/event-bus';
import { NodeResultSlip } from './NodeResultSlip';

type TriggerData = AIStepNodeData & { hideSlip?: boolean };

const PLACEHOLDER = '在这里描述你的学习目标...\n\n例如：帮我系统学习机器学习基础，重点掌握线性回归和梯度下降。';
const MAX_CHARS = 500;

function TriggerInputNode({ data, selected, id }: NodeProps) {
  const nodeData = data as unknown as TriggerData;
  const nodeTheme = getNodeTheme('trigger_input');
  const { status, output, output_format, error, input_snapshot, execution_time_ms } = nodeData;

  // user_content is the primary stored value; label is the short display title
  const userContent = nodeData.user_content ?? '';
  const [draft, setDraft] = useState(userContent);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showAllNodeSlips = useWorkflowStore((s) => s.showAllNodeSlips);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const clickConnectState = useWorkflowStore((s) => s.clickConnectState);
  const isWaitingTarget = clickConnectState.phase === 'waiting-target';

  const [activePart, setActivePart] = useState<'card' | 'slip'>('card');
  const hideSlip = nodeData.hideSlip === true;
  const isSlipVisible = showAllNodeSlips && !hideSlip;

  const cardShadow = selected && activePart === 'card'
    ? 'ring-2 ring-primary/40 shadow-xl shadow-primary/10 scale-[1.02]'
    : '';

  const charCount = draft.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Commit edits to store on blur
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    const trimmed = draft.trim();
    if (trimmed === userContent.trim()) return; // no change
    updateNodeData(id, {
      user_content: trimmed,
      // Update label to first line (max 60 chars) for canvas readability
      label: trimmed.split('\n')[0]?.slice(0, 60) || '输入触发',
    });
  }, [draft, id, updateNodeData, userContent]);

  // Auto-resize textarea to fit content
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    // Auto grow
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Prevent ReactFlow from dragging when typing inside textarea
  const stopPropagation = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  const handleHandleClick = useCallback(
    (e: React.MouseEvent, handleId: string, handleType: 'source' | 'target') => {
      e.stopPropagation();
      const store = useWorkflowStore.getState();
      const state = store.clickConnectState;
      if (handleType === 'source') {
        if (state.phase === 'idle') {
          store.startClickConnect(id, handleId);
        } else if (state.phase === 'waiting-target' && state.sourceNodeId === id) {
          store.cancelClickConnect();
        } else {
          store.startClickConnect(id, handleId);
        }
      } else {
        if (state.phase === 'waiting-target') {
          store.completeClickConnect(id, handleId);
        }
      }
    },
    [id]
  );

  const isRunning = status === 'running';
  const isDone = status === 'done';

  return (
    <div
      className="relative w-[22rem] transition-all duration-200"
      role="article"
      aria-label={`输入节点: ${nodeData.label}`}
    >
      {/* 主卡片 */}
      <div
        className={`${cardShadow} node-paper-bg relative w-full rounded-md transition-all duration-200 ${nodeTheme.borderClass} p-6 flex flex-col z-20`}
        onClick={() => setActivePart('card')}
      >
        {/* Target Handle（通常 trigger_input 入度=0，但保留以防手动连接） */}
        <Handle
          type="target"
          id="target-left"
          position={Position.Left}
          className={`node-handle !h-3 !w-3 !-left-[8px] !border-2 !border-background !bg-current z-10 ${nodeTheme.headerTextColor} ${isWaitingTarget ? 'node-handle-click-target' : ''}`}
          onClick={(e) => handleHandleClick(e, 'target-left', 'target')}
        />
        <div className={`absolute inset-1 pointer-events-none z-0 ${nodeTheme.innerBorderClass}`} />

        <div className="relative z-10 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className={`flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase font-bold ${nodeTheme.headerTextColor}`}>
              <Play className="h-3.5 w-3.5" />
              #{id.slice(0, 3)}_INPUT
              {isRunning && (
                <span className="rounded-sm border border-cyan-500/40 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-cyan-600 dark:text-cyan-300 animate-pulse">
                  ACTIVE
                </span>
              )}
              {isDone && (
                <span className="rounded-sm border border-green-500/40 bg-green-500/10 px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-green-600 dark:text-green-300">
                  DONE
                </span>
              )}
            </div>
            <button
              type="button"
              className="rounded-sm border border-black/10 px-1.5 py-1 text-black/45 transition-colors hover:bg-black/5 hover:text-black dark:border-white/10 dark:text-white/45 dark:hover:bg-white/5 dark:hover:text-white"
              title="节点配置"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                eventBus.emit('workflow:open-node-config', {
                  nodeId: id,
                  anchorRect: {
                    top: rect.top, left: rect.left,
                    right: rect.right, bottom: rect.bottom,
                    width: rect.width, height: rect.height,
                  },
                });
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Inline editable textarea */}
          <div className="mb-3">
            <label
              className={`block text-[11px] font-mono tracking-wider uppercase mb-2 transition-colors ${
                isFocused
                  ? 'text-cyan-500 dark:text-cyan-400'
                  : 'text-black/40 dark:text-white/40'
              }`}
            >
              学习目标 · 工作流入口
            </label>
            <div
              className={`relative rounded-sm border transition-all duration-150 ${
                isFocused
                  ? 'border-cyan-400/60 shadow-[0_0_0_2px_rgba(6,182,212,0.12)]'
                  : 'border-black/12 dark:border-white/12 hover:border-black/25 dark:hover:border-white/25'
              } bg-black/[0.025] dark:bg-white/[0.025]`}
            >
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                onMouseDown={stopPropagation}
                onKeyDown={stopPropagation}
                placeholder={PLACEHOLDER}
                rows={3}
                className={`nodrag nowheel w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-black dark:text-white placeholder:text-black/30 dark:placeholder:text-white/30 focus:outline-none ${
                  isOverLimit ? 'text-red-500 dark:text-red-400' : ''
                }`}
                style={{ minHeight: '80px', maxHeight: '240px' }}
                aria-label="学习目标输入"
              />
              {/* Char counter */}
              {(isFocused || charCount > 0) && (
                <div className={`absolute bottom-1.5 right-2 text-[10px] font-mono tabular-nums ${
                  isOverLimit ? 'text-red-500' : 'text-black/30 dark:text-white/30'
                }`}>
                  {charCount}/{MAX_CHARS}
                </div>
              )}
            </div>

            {/* Hint when empty */}
            {!draft && !isFocused && (
              <p className="mt-2 text-[11px] text-black/40 dark:text-white/40 italic">
                点击上方输入框，在此处直接描述你的学习目标
              </p>
            )}

            {/* Content preview when collapsed (not focused, has content) */}
            {draft && !isFocused && (
              <p className="mt-2 text-[11px] text-black/50 dark:text-white/50 line-clamp-1 font-mono">
                ✓ {draft.split('\n')[0]?.slice(0, 50)}
                {draft.split('\n')[0] && draft.split('\n')[0].length > 50 ? '…' : ''}
              </p>
            )}
          </div>

          {/* Divider */}
          <hr className="border-t border-dashed border-black/10 dark:border-white/10 mb-3" />

          {/* Description */}
          <p className="text-[12px] text-black/45 dark:text-white/45 font-serif">
            工作流执行入口 — 此处的内容将作为上游学习目标传递给所有下游节点
          </p>
        </div>

        {/* Source Handle */}
        <Handle
          type="source"
          id="source-right"
          position={Position.Right}
          className={`node-handle !h-3 !w-3 !-right-[8px] !border-2 !border-background !bg-current z-10 ${nodeTheme.headerTextColor}`}
          onClick={(e) => handleHandleClick(e, 'source-right', 'source')}
        />
      </div>

      {/* 底部运行详情 */}
      {isSlipVisible && (
        <NodeResultSlip
          nodeId={id}
          status={status}
          output={output || ''}
          error={error}
          inputSnapshot={input_snapshot}
          nodeType="trigger_input"
          outputFormat={output_format}
          executionTimeMs={execution_time_ms}
          isSelected={selected && activePart === 'slip'}
          onFocusSlip={() => setActivePart('slip')}
        />
      )}
    </div>
  );
}

export default memo(TriggerInputNode);
