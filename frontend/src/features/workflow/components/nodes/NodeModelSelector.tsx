import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import { groupModelsByProvider, canAccessModel, type AIModelOption } from '../../constants/ai-models';
import { useWorkflowCatalog } from '../../hooks/use-workflow-catalog';
import { getUser, type UserInfo } from '@/services/auth.service';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NodeModelSelectorProps {
  nodeId: string;
  currentModel: string;
  nodeThemeColor: string;
}

export const NodeModelSelector: React.FC<NodeModelSelectorProps> = ({
  nodeId,
  currentModel,
}) => {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const { models, isLoading } = useWorkflowCatalog();
  const [user, setUser] = useState<UserInfo | null>(null);
  const userTier = user?.tier;

  useEffect(() => {
    getUser().then(setUser).catch(() => null);
  }, []);

  const groups = groupModelsByProvider(models);

  const handleSelect = (model: AIModelOption) => {
    if (!canAccessModel(userTier, model)) return;
    updateNodeData(nodeId, { model_route: model.model });
  };

  // When currentModel is empty or not found in catalog → show unset placeholder
  const selectedModelInfo = currentModel
    ? models.find((m) => m.model === currentModel)
    : undefined;

  const isUnset = !currentModel || !selectedModelInfo;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="node-model-selector-trigger group flex items-center gap-1.5 focus:outline-none bg-transparent border-none font-mono text-[9px] uppercase transition-all px-1 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
          title={isLoading ? '加载模型列表...' : isUnset ? '点击选择 AI 模型' : '切换 AI 模型'}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse bg-stone-400" />
          ) : isUnset ? (
            /* Unset state: pulsing empty dot + italic placeholder */
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
              <span className="opacity-70 group-hover:opacity-100">{selectedModelInfo.model}</span>
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-56 node-paper-bg border border-dashed border-black/20 dark:border-white/20 shadow-xl"
        align="start"
      >
        {Object.entries(groups).map(([providerName, providerModels], idx) => (
          <React.Fragment key={providerName}>
            {idx > 0 && <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-serif text-[10px] opacity-70 px-2 py-1">
                {providerName}
              </DropdownMenuLabel>
              {providerModels.map((model) => {
                const accessible = canAccessModel(userTier, model);
                const isActive = model.model === currentModel;
                return (
                  <DropdownMenuItem
                    key={model.model}
                    onClick={() => handleSelect(model)}
                    disabled={!accessible}
                    className={`font-mono text-[10px] cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-sm transition-colors
                      ${isActive ? 'bg-black/8 dark:bg-white/10 font-semibold' : ''}
                      ${!accessible ? 'opacity-40 cursor-not-allowed' : 'focus:bg-black/5 dark:focus:bg-white/10'}
                    `}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: model.brandColor }}
                    />
                    <span className="flex-1 truncate">{model.model}</span>
                    {model.isPremium && (
                      <span className={`text-[8px] border px-1 rounded-sm ml-auto shrink-0
                        ${accessible
                          ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'border-stone-400/30 text-stone-500'}
                      `}>
                        PRO
                      </span>
                    )}
                    {isActive && (
                      <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
