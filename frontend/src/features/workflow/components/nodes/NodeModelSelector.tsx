'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { groupModelsByVendor, canAccessModel, type AIModelOption } from '../../constants/ai-models';
import { useWorkflowCatalog } from '../../hooks/use-workflow-catalog';
import { getUser, type UserInfo } from '@/services/auth.service';

interface NodeModelSelectorProps {
  nodeId: string;
  currentModel: string;
  nodeThemeColor: string;
}

// 提取清洗文本：去除半角和全角的括号及其后面的文字
const formatModelName = (name: string) => name.replace(/\s*[（(].*?[）)]/g, '').trim();

/**
 * Track B — Workflow Node Model Selector (2-level: Vendor → Model)
 *
 * Uses manual dropdown (useState + useRef) instead of Radix DropdownMenu
 * to avoid ReactFlow event-swallowing and Portal positioning conflicts.
 */
export const NodeModelSelector: React.FC<NodeModelSelectorProps> = ({
  nodeId,
  currentModel,
}) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const { models, isLoading } = useWorkflowCatalog();
  const [user, setUser] = useState<UserInfo | null>(null);
  const userTier = user?.tier;

  const [open, setOpen] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedVendor(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const vendorGroups = groupModelsByVendor(models);

  const handleSelect = useCallback((model: AIModelOption) => {
    if (!canAccessModel(userTier, model)) return;
    updateNodeData(nodeId, { model_route: model.model });
    setOpen(false);
    setExpandedVendor(null);
  }, [userTier, updateNodeData, nodeId]);

  const selectedModelInfo = currentModel
    ? models.find((m) => m.model === currentModel)
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
          if (open) setExpandedVendor(null);
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
          onMouseLeave={() => setExpandedVendor(null)}
        >
          {vendorEntries.map(([vendorName, vendorModels]) => {
            const isExpanded = expandedVendor === vendorName;
            const vendorColor = vendorModels[0]?.brandColor ?? '#4B5563';

            return (
              <div 
                key={vendorName} 
                className="relative"
                onMouseEnter={() => setExpandedVendor(vendorName)}
              >
                <button
                  type="button"
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors
                    ${isExpanded ? 'bg-black/5 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Optional: click also toggles in case hover is finicky (e.g. touch/tablet)
                    setExpandedVendor(isExpanded ? null : vendorName);
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
                  <div className="absolute left-full top-0 ml-1 min-w-[13rem] z-[10000] rounded-lg node-paper-bg border border-dashed border-black/20 dark:border-white/20 shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1.5 text-[9px] font-bold text-black/40 dark:text-white/40 uppercase tracking-widest border-b border-dashed border-black/10 dark:border-white/10 mb-1">
                      {vendorName}
                    </div>
                    {vendorModels.map((model) => {
                      const accessible = canAccessModel(userTier, model);
                      const isActive = model.model === currentModel;

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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
