'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Crown, Star, Zap } from 'lucide-react';
import { canAccessModel, type AIModelOption } from '@/features/workflow/constants/ai-models';
import { type ChatModelOption } from '@/services/ai-catalog.service';
import type { TierType } from '@/services/auth.service';

// Track A: Chat panel uses ChatModelOption (curated flat list)
// Track B: Workflow nodes use AIModelOption (full catalog with provider grouping)

interface ChatModelSelectorProps {
  value: ChatModelOption | null;
  options: ChatModelOption[];
  onChange: (model: ChatModelOption) => void;
  userTier?: TierType;
}

interface LegacyModelSelectorProps {
  value: AIModelOption;
  options: AIModelOption[];
  onChange: (model: AIModelOption) => void;
  userTier?: TierType;
}

type ModelSelectorProps = ChatModelSelectorProps | LegacyModelSelectorProps;

function isChatMode(props: ModelSelectorProps): props is ChatModelSelectorProps {
  return !props.value || 'key' in props.value;
}

export function ModelSelector(props: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isChatMode(props)) {
    return <ChatModelSelectorUI {...props} open={open} setOpen={setOpen} containerRef={ref} />;
  }
  return <LegacyModelSelectorUI {...(props as LegacyModelSelectorProps)} open={open} setOpen={setOpen} containerRef={ref} />;
}

// ─── Track A: Curated flat list (Chat Panel) ───────────────────────────────
function ChatModelSelectorUI({
  value,
  options,
  onChange,
  userTier,
  open,
  setOpen,
  containerRef,
}: ChatModelSelectorProps & { open: boolean; setOpen: (v: boolean) => void; containerRef: React.RefObject<HTMLDivElement> }) {
  const tierOrder: Record<string, number> = { free: 0, pro: 1, pro_plus: 2, ultra: 3 };
  const userLevel = tierOrder[userTier ?? 'free'] ?? 0;

  const handleSelect = (model: ChatModelOption) => {
    const requiredLevel = tierOrder[model.requiredTier] ?? 0;
    if (userLevel < requiredLevel) return;
    onChange(model);
    setOpen(false);
  };

  const displayName = value?.displayName ?? '选择模型';
  const brandColor = value?.brandColor ?? '#4B5563';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-border/50 node-paper-bg px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-all hover:border-primary/30 hover:shadow-sm"
      >
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
        <span className="truncate max-w-[120px]">{displayName}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[260px] rounded-xl border-[1.5px] border-border/50 node-paper-bg p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70 font-serif">
            选择模型
          </div>

          <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
            {options.map((model) => {
              const requiredLevel = tierOrder[model.requiredTier] ?? 0;
              const isSelected = value?.key === model.key;
              const isLocked = userLevel < requiredLevel;

              return (
                <button
                  key={model.key}
                  type="button"
                  onClick={() => handleSelect(model)}
                  disabled={isLocked}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                    isLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/5'
                  } ${isSelected ? 'bg-primary/8 ring-1 ring-primary/20' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[12px] font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                        {model.displayName}
                      </span>
                      {model.isPremium && (
                        <span className="flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500 shrink-0">
                          <Crown className="h-2.5 w-2.5" />
                          {model.requiredTier.toUpperCase()}
                        </span>
                      )}
                      {model.isRecommended && (
                        <span className="flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Star className="h-2.5 w-2.5" />
                          推荐
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 truncate block">
                      {model.description}
                    </span>
                  </div>
                  {isSelected ? <Zap className="h-3 w-3 text-primary shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Track B legacy shim (kept for any remaining AIModelOption callers) ─────
function LegacyModelSelectorUI({
  value,
  options,
  onChange,
  userTier,
  open,
  setOpen,
  containerRef,
}: LegacyModelSelectorProps & { open: boolean; setOpen: (v: boolean) => void; containerRef: React.RefObject<HTMLDivElement> }) {
  const handleSelect = (model: AIModelOption) => {
    if (!canAccessModel(userTier, model)) return;
    onChange(model);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-lg border-[1.5px] border-border/50 node-paper-bg px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 transition-all hover:border-primary/30 hover:shadow-sm"
      >
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: value.brandColor }} />
        <span className="truncate max-w-[120px]">{value.displayName}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[260px] rounded-xl border-[1.5px] border-border/50 node-paper-bg p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70 font-serif">
            选择模型
          </div>
          <div className="max-h-[320px] overflow-y-auto scrollbar-hide">
            {options.map((model) => {
              const isSelected = value.skuId === model.skuId;
              const isLocked = !canAccessModel(userTier, model);
              return (
                <button
                  key={model.skuId}
                  type="button"
                  onClick={() => handleSelect(model)}
                  disabled={isLocked}
                  className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                    isLocked ? 'cursor-not-allowed opacity-60' : 'hover:bg-white/5'
                  } ${isSelected ? 'bg-primary/8 ring-1 ring-primary/20' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[12px] font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                        {model.displayName}
                      </span>
                      {model.isPremium && (
                        <span className="flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-500 shrink-0">
                          <Crown className="h-2.5 w-2.5" />
                          {model.requiredTier.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 truncate block">{model.description}</span>
                  </div>
                  {isSelected ? <Zap className="h-3 w-3 text-primary shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
