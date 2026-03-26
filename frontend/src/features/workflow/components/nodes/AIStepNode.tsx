'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AIStepNodeData } from '@/types';
import { getNodeTypeMeta, getNodeTheme } from '@/features/workflow/constants/workflow-meta';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import BranchManagerPanel from './BranchManagerPanel';
import { NodeModelSelector } from './NodeModelSelector';
import { NodeInputBadges } from './NodeInputBadges';
import { NodeResultSlip } from './NodeResultSlip';

function AIStepNode({ data, selected, type, id }: NodeProps) {
  const nodeData = data as unknown as AIStepNodeData;
  const { error, label, model_route, output, output_format, status, input_snapshot, execution_time_ms } = nodeData;
  const nodeType = nodeData.type ?? type ?? 'chat_response';
  const typeMeta = getNodeTypeMeta(nodeType);
  const isActive = status === 'running' || status === 'waiting' || selected;
  const nodeTheme = getNodeTheme(nodeType);
  const isLogicSwitch = nodeType === 'logic_switch';
  const statusBadge = status === 'running' ? '(ACTIVE)' : status === 'waiting' ? '(WAIT)' : '';
  
  const cardShadow = isActive ? 'ring-2 ring-primary/40 shadow-xl shadow-primary/10 scale-[1.02]' : '';

  // Click-to-connect
  const clickConnectState = useWorkflowStore((s) => s.clickConnectState);
  const isWaitingTarget = clickConnectState.phase === 'waiting-target';
  const isSourceOfCurrentConnect = isWaitingTarget && clickConnectState.sourceNodeId === id;

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

  return (
    <div
      className="relative w-[22rem] transition-all duration-200"
      role="article"
      aria-label={`节点: ${label}`}
    >
      {/* Target Handles (输入) */}
      <Handle type="target" id="target-left" position={Position.Left}
        className={`node-handle !h-3 !w-3 !-left-[8px] !border-2 !border-background !bg-current z-20 ${nodeTheme.headerTextColor} ${isWaitingTarget && !isSourceOfCurrentConnect ? 'node-handle-click-target' : ''}`}
        onClick={(e) => handleHandleClick(e, 'target-left', 'target')}
      />
      <Handle type="target" id="target-top" position={Position.Top}
        className={`node-handle !h-3 !w-3 !-top-[8px] !border-2 !border-background !bg-current z-20 ${nodeTheme.headerTextColor} ${isWaitingTarget && !isSourceOfCurrentConnect ? 'node-handle-click-target' : ''}`}
        onClick={(e) => handleHandleClick(e, 'target-top', 'target')}
      />

      {/* 主卡片 */}
      <div className={`${cardShadow} node-paper-bg relative w-full rounded-md transition-all duration-200 ${nodeTheme.borderClass} p-6 flex flex-col`}>
        <div className={`absolute inset-1 pointer-events-none z-0 ${nodeTheme.innerBorderClass}`} />
        
        <div className="relative z-10 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className={`flex items-center gap-2 text-[11px] font-mono tracking-wider uppercase font-bold ${nodeTheme.headerTextColor}`}>
              <typeMeta.icon className="h-3.5 w-3.5" />
              #{id.slice(0, 3)}_{nodeTheme.category} {statusBadge}
              {isLogicSwitch && (
                <span className="rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] tracking-[0.18em] text-amber-700 dark:text-amber-300">
                  BRANCH
                </span>
              )}
            </div>
            {typeMeta.requiresModel && (
              <NodeModelSelector nodeId={id} currentModel={model_route ?? ''} nodeThemeColor="currentColor" />
            )}
          </div>

          {/* Title & Desc */}
          <div className="mb-2">
            <h3 className="text-[22px] font-bold font-serif text-black dark:text-white leading-tight tracking-wide mb-2">
              {label}
            </h3>
            <p className="text-[13px] text-black/60 dark:text-white/60 font-serif leading-relaxed line-clamp-2">
              {typeMeta.description}
            </p>
            {isLogicSwitch && (
              <div className="mt-3 inline-flex items-center gap-1 rounded-sm border border-dashed border-amber-500/40 bg-amber-500/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-amber-700 dark:text-amber-300">
                ⑂ 从右侧或底部拖出分支
              </div>
            )}
            
            <NodeInputBadges nodeType={nodeType} />
          </div>

          {/* Branch manager — logic_switch only, when selected */}
          {isLogicSwitch && selected && (
            <>
              <hr className="border-t-[1px] border-dashed border-black/15 dark:border-white/15 my-4" />
              <BranchManagerPanel nodeId={id} />
            </>
          )}
        </div>
      </div>

      {/* 底部悬挂纸条 */}
      <NodeResultSlip
        nodeId={id}
        status={status}
        output={output || ''}
        error={error}
        inputSnapshot={input_snapshot}
        nodeType={nodeType}
        outputFormat={output_format}
        executionTimeMs={execution_time_ms}
      />

      {/* Source Handles (输出) */}
      <Handle type="source" id="source-right" position={Position.Right}
        className={`node-handle !h-3 !w-3 !-right-[8px] !border-2 !border-background !bg-current z-20 ${nodeTheme.headerTextColor} ${isSourceOfCurrentConnect && clickConnectState.sourceHandleId === 'source-right' ? 'node-handle-click-source-active' : ''}`}
        onClick={(e) => handleHandleClick(e, 'source-right', 'source')}
      />
      <Handle type="source" id="source-bottom" position={Position.Bottom}
        className={`node-handle !h-3 !w-3 !-bottom-[8px] !border-2 !border-background !bg-current z-20 ${nodeTheme.headerTextColor} ${isSourceOfCurrentConnect && clickConnectState.sourceHandleId === 'source-bottom' ? 'node-handle-click-source-active' : ''}`}
        onClick={(e) => handleHandleClick(e, 'source-bottom', 'source')}
      />
    </div>
  );
}

export default memo(AIStepNode);
