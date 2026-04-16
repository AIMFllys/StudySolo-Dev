'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { groupModelsByVendor, canAccessModel, type AIModelOption } from '../../constants/ai-models';
import { useWorkflowCatalog } from '../../hooks/use-workflow-catalog';
import { getUser, type UserInfo } from '@/services/auth.service';
import { getAgentModels, type AgentModelsResponse } from '@/services/agent.service';
import type { NodeModelSource } from '@/types';

interface NodeModelSelectorProps {
  nodeId: string;
  nodeType: string;
  currentModel: string;
  nodeThemeColor: string;
  modelSource?: NodeModelSource;
  agentName?: string | null;
}

// 提取清洗文本：去除半角和全角的括号及其后面的文字
const formatModelName = (name: string) => name.replace(/\s*[（(].*?[）)]/g, '').trim();

/**
 * Track B — Workflow Node Model Selector (2-level: Vendor → Model)
 *
 * Uses manual dropdown (useState + useRef) instead of Radix DropdownMenu
 * to avoid ReactFlow event-swallowing and Portal positioning conflicts.
 */
function CatalogNodeModelSelector({
  nodeId,
  currentModel,
}: Pick<NodeModelSelectorProps, 'nodeId' | 'currentModel'>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const { models, isLoading } = useWorkflowCatalog();
  const [user, setUser] = useState<UserInfo | null>(null);
  const userTier = user?.tier;

  const [open, setOpen] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理延迟定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // 安全切换厂商面板：带 150ms 延迟，允许鼠标"走对角线"
  const setVendorSafe = useCallback((vendorName: string | null, immediate = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (immediate) {
      setExpandedVendor(vendorName);
    } else {
      timeoutRef.current = setTimeout(() => {
        setExpandedVendor(vendorName);
      }, 150); // 150ms 足够抵消因为对角线移动而在别人项上短暂掠过的情况
    }
  }, []);

  useEffect(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setVendorSafe(null, true);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setVendorSafe]);

  const vendorGroups = groupModelsByVendor(models);

  const handleSelect = useCallback((model: AIModelOption) => {
    if (!canAccessModel(userTier, model)) return;
    updateNodeData(nodeId, { model_route: model.skuId });
    setOpen(false);
    setVendorSafe(null, true);
  }, [userTier, updateNodeData, nodeId, setVendorSafe]);

  const selectedModelInfo = currentModel
    ? models.find((m) => m.skuId === currentModel || m.model === currentModel)
    : undefined;

  const isUnset = !currentModel || !selectedModelInfo;
  const vendorEntries = Object.entries(vendorGroups);

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger — stopPropagation prevents ReactFlow drag/select */}
      <button
        type="button"
        className="node-model-selector-trigger group flex items-center gap-1.5 focus:outline-none bg-transparent border-none font-mono text-[9px] uppercase transition-all px-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
        title={isLoading ? '加载模型列表...' : isUnset ? '点击选择 AI 模型' : '切换 AI 模型'}
        disabled={isLoading}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          if (open) {
            setVendorSafe(null, true);
          }
        }}
      >
        {isLoading ? (
          <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse bg-stone-400" />
        ) : isUnset ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full border border-dashed border-black/30 dark:border-white/30 inline-block" />
            <span className="opacity-40 italic tracking-wide">选择模型</span>
          </>
        ) : (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full inline-block transition-colors"
              style={{ backgroundColor: selectedModelInfo.brandColor }}
            />
            <span className="opacity-70 group-hover:opacity-100">{formatModelName(selectedModelInfo.displayName)}</span>
          </>
        )}
      </button>

      {/* L1: Vendor list */}
      {open && (
        <div
          className="absolute right-0 top-full z-[9999] mt-1 w-44 rounded-lg node-paper-bg border border-dashed border-black/20 dark:border-white/20 shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseLeave={() => setVendorSafe(null, false)}
        >
          {vendorEntries.map(([vendorName, vendorModels]) => {
            const isExpanded = expandedVendor === vendorName;
            const vendorColor = vendorModels[0]?.brandColor ?? '#4B5563';

            return (
              <div 
                key={vendorName} 
                className="relative"
                onMouseEnter={() => {
                  // 如果已经是我，那么立即清除任何可能的离场倒计时（巩固悬停）；否则走 150ms 延时
                  setVendorSafe(vendorName, isExpanded);
                }}
              >
                <button
                  type="button"
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors
                    ${isExpanded ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Optional: click also toggles in case hover is finicky (e.g. touch/tablet)
                    setVendorSafe(isExpanded ? null : vendorName, true);
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: vendorColor }}
                  />
                  <span className="flex-1 truncate font-semibold opacity-70">{vendorName}</span>
                  <svg
                    className="w-3 h-3 opacity-40 ml-auto"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7" />
                  </svg>
                </button>

                {/* L2: Model list (Flyout / Cascading menu to the right) */}
                {isExpanded && (
                  // 外层加了 pl-1，打造无形的“悬浮安全桥 (CSS Padding Bridge)”，替代 ml-1 以防止物理脱出
                  <div className="absolute left-full top-0 pl-1 z-[10000]">
                    <div className="min-w-[13rem] rounded-lg node-paper-bg border border-dashed border-black/20 dark:border-white/20 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1.5 text-[9px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest border-b border-dashed border-black/10 dark:border-white/10 mb-1">
                        {vendorName}
                      </div>
                    {vendorModels.map((model) => {
                      const accessible = canAccessModel(userTier, model);
                      const isActive = model.skuId === currentModel || model.model === currentModel;

                      return (
                        <button
                          key={model.model}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(model);
                          }}
                          disabled={!accessible}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors
                            ${!accessible ? 'opacity-40 cursor-not-allowed' : 'hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer'}
                            ${isActive ? 'bg-black/8 dark:bg-white/10 font-semibold' : ''}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: model.brandColor }}
                          />
                          <span className="flex-1 truncate">{formatModelName(model.displayName)}</span>
                          {model.isPremium && (
                            <span className={`text-[8px] border px-1 rounded-sm shrink-0 ${
                              accessible
                                ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                                : 'border-stone-400/30 text-stone-500'
                            }`}>
                              PRO
                            </span>
                          )}
                          {isActive && (
                            <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentNodeModelSelector({
  nodeId,
  currentModel,
  agentName,
}: Pick<NodeModelSelectorProps, 'nodeId' | 'currentModel' | 'agentName'>) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modelInfo, setModelInfo] = useState<AgentModelsResponse | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agentName) {
      setIsLoading(false);
      setModelInfo(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const info = await getAgentModels(agentName);
        if (!cancelled) {
          setModelInfo(info);
        }
      } catch {
        if (!cancelled) {
          setModelInfo({
            agent: agentName,
            healthy: false,
            source: 'registry-fallback',
            models: [],
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentName]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const models = modelInfo?.models ?? [];
  const selectedModel = currentModel.trim();
  const isUnset = !selectedModel;
  const selectedDisplay = isUnset ? '默认模型' : formatModelName(selectedModel);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="node-model-selector-trigger group flex items-center gap-1.5 focus:outline-none bg-transparent border-none font-mono text-[9px] uppercase transition-all px-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
        title={isLoading ? '加载 Agent 模型列表...' : `切换 ${agentName ?? 'Agent'} 模型`}
        disabled={isLoading}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        {isLoading ? (
          <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse bg-stone-400" />
        ) : (
          <>
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block transition-colors ${
                modelInfo?.healthy ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className={`group-hover:opacity-100 ${isUnset ? 'opacity-40 italic tracking-wide' : 'opacity-70'}`}>
              {selectedDisplay}
            </span>
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-[9999] mt-1 w-56 rounded-lg node-paper-bg border border-dashed border-black/20 dark:border-white/20 shadow-xl py-1 animate-in fade-in slide-in-from-top-1 duration-150"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1.5 border-b border-dashed border-black/10 dark:border-white/10 mb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">
                {agentName}
              </span>
              <span className={`text-[8px] ${modelInfo?.healthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-300'}`}>
                {modelInfo?.healthy ? 'Healthy' : 'Fallback'}
              </span>
            </div>
            <p className="mt-1 text-[9px] text-black/45 dark:text-white/45">
              {modelInfo?.source === 'runtime' ? '来源: /v1/models' : '来源: 注册表回退'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              updateNodeData(nodeId, { model_route: '' });
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
              isUnset ? 'bg-black/8 dark:bg-white/10 font-semibold' : ''
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-400" />
            <span className="flex-1 truncate">默认模型（自动）</span>
            {isUnset && <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />}
          </button>

          {models.map((model) => {
            const isActive = model === selectedModel;
            return (
              <button
                key={model}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateNodeData(nodeId, { model_route: model });
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                  isActive ? 'bg-black/8 dark:bg-white/10 font-semibold' : ''
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-rose-500" />
                <span className="flex-1 truncate">{formatModelName(model)}</span>
                {isActive && <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />}
              </button>
            );
          })}

          {!isLoading && models.length === 0 && (
            <p className="px-2.5 py-2 text-[10px] text-black/45 dark:text-white/45">
              当前没有可选模型，将回退到 Agent 默认模型。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export const NodeModelSelector: React.FC<NodeModelSelectorProps> = ({
  nodeId,
  currentModel,
  modelSource,
  agentName,
}) => {
  if (modelSource === 'none') {
    return null;
  }

  if (modelSource === 'agent' && agentName) {
    return (
      <AgentNodeModelSelector
        nodeId={nodeId}
        currentModel={currentModel}
        agentName={agentName}
      />
    );
  }

  return (
    <CatalogNodeModelSelector
      nodeId={nodeId}
      currentModel={currentModel}
    />
  );
};
