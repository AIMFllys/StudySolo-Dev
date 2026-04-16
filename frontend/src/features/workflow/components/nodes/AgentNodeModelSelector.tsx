'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflow/use-workflow-store';
import { getAgentModels, type AgentModelsResponse } from '@/services/agent.service';
import { formatModelName } from './CatalogNodeModelSelector';

interface Props {
  nodeId: string;
  currentModel: string;
  agentName?: string | null;
}

export function AgentNodeModelSelector({ nodeId, currentModel, agentName }: Props) {
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
        if (!cancelled) setModelInfo(info);
      } catch {
        if (!cancelled) {
          setModelInfo({ agent: agentName, healthy: false, source: 'registry-fallback', models: [] });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
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
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        {isLoading ? (
          <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse bg-stone-400" />
        ) : (
          <>
            <span className={`w-1.5 h-1.5 rounded-full inline-block transition-colors ${modelInfo?.healthy ? 'bg-emerald-500' : 'bg-amber-500'}`} />
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
              <span className="text-[9px] font-bold uppercase tracking-widest text-black/40 dark:text-white/40">{agentName}</span>
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
            onClick={(e) => { e.stopPropagation(); updateNodeData(nodeId, { model_route: '' }); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${isUnset ? 'bg-black/8 dark:bg-white/10 font-semibold' : ''}`}
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
                onClick={(e) => { e.stopPropagation(); updateNodeData(nodeId, { model_route: model }); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${isActive ? 'bg-black/8 dark:bg-white/10 font-semibold' : ''}`}
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
