'use client';

import { useState, useRef, useEffect } from 'react';
import { Layers, ChevronRight, Zap, Crown, Gem, User, X } from 'lucide-react';
import type { UserWorkflowQuota } from '@/services/workflow.server.service';

interface WorkspaceCapacityBadgeProps {
  quota: UserWorkflowQuota;
}

// Tier display metadata
const TIER_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  free:      { label: '免费版', icon: <User className="h-3 w-3" />,  color: 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800' },
  pro:       { label: 'Pro 版', icon: <Gem className="h-3 w-3" />,   color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30' },
  pro_plus:  { label: 'Pro+ 版', icon: <Zap className="h-3 w-3" />,  color: 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/30' },
  ultra:     { label: 'Ultra 版', icon: <Crown className="h-3 w-3" />, color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30' },
};

const TIER_WORKFLOW_PLANS = [
  { tier: 'free',     label: '免费版', count: '10 个',    price: '¥0',      highlight: false },
  { tier: 'pro',      label: 'Pro 版', count: '50 个',    price: '¥25/月',  highlight: true  },
  { tier: 'pro_plus', label: 'Pro+ 版', count: '200 个', price: '¥79/月',  highlight: false },
  { tier: 'ultra',    label: 'Ultra 版', count: '无限制', price: '¥1299/月', highlight: false },
];

function getProgressColor(ratio: number) {
  if (ratio >= 1)    return 'bg-rose-500';
  if (ratio >= 0.8)  return 'bg-rose-400';
  if (ratio >= 0.6)  return 'bg-amber-400';
  return 'bg-emerald-400';
}

function getBadgeStyle(ratio: number) {
  if (ratio >= 1)   return 'text-rose-600 border-rose-200/60 bg-rose-50/80 dark:text-rose-400 dark:border-rose-900/60 dark:bg-rose-900/20';
  if (ratio >= 0.8) return 'text-amber-600 border-amber-200/60 bg-amber-50/80 dark:text-amber-400 dark:border-amber-900/60 dark:bg-amber-900/20';
  return 'text-slate-600 border-black/5 bg-white/80 dark:text-slate-300 dark:border-white/10 dark:bg-card/80';
}

function getStatusMessage(ratio: number, isUltra: boolean) {
  if (isUltra) return '工作流空间完全无限制 🎉';
  if (ratio >= 1)   return '🚫 工作流已满，无法新建';
  if (ratio >= 0.8) return '⚠️ 工作流容量即将用满';
  if (ratio >= 0.6) return '工作流空间即将进入繁忙区';
  return '你还有充足的工作流空间';
}

export default function WorkspaceCapacityBadge({ quota }: WorkspaceCapacityBadgeProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isUltra = quota.tier === 'ultra';
  const ratio = isUltra ? 0 : quota.workflows_used / Math.max(quota.workflows_total, 1);
  const progressPct = Math.min(ratio * 100, 100);
  const tierInfo = TIER_INFO[quota.tier] ?? TIER_INFO.free;

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const upgradeTier = quota.tier === 'free' ? 'Pro' : quota.tier === 'pro' ? 'Pro+' : null;

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger Badge ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-2.5 rounded-full px-4 py-2 border backdrop-blur-sm shadow-sm transition-all hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 ${getBadgeStyle(ratio)}`}
      >
        <Layers className={`h-4 w-4 ${ratio >= 0.8 ? 'text-rose-400 animate-pulse' : 'text-slate-400'}`} />
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold">{isUltra ? '∞' : quota.workflows_used}</span>
          <span className="text-[11px] font-medium text-slate-400">
            / {isUltra ? '∞' : quota.workflows_total} 容量
          </span>
        </div>
      </button>

      {/* ── Popover Panel ── */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 z-50 w-[320px] rounded-2xl
                     bg-[#faf9f7] dark:bg-card border border-black/[0.07] dark:border-border
                     shadow-[0_8px_32px_rgba(0,0,0,0.12),_inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-xl
                     overflow-hidden"
        >
          {/* Paper texture header */}
          <div className="relative bg-[#f5f3ef] dark:bg-muted border-b border-black/[0.06] dark:border-white/10 px-5 py-4">
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 dark:from-white/5 to-transparent pointer-events-none" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-serif text-[15px] font-semibold text-slate-800 dark:text-slate-200">工作流容量</span>
                  {/* Tier badge */}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierInfo.color}`}>
                    {tierInfo.icon}
                    {tierInfo.label}
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400">{getStatusMessage(ratio, isUltra)}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="px-5 py-4 flex flex-col gap-4">
            {/* Progress bar section */}
            {!isUltra && (
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                    已使用 <strong className="text-slate-700 dark:text-slate-200">{quota.workflows_used}</strong> 个
                    {quota.workflows_addon_qty > 0 && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400 text-[11px]">(含 +{quota.workflows_addon_qty} 增值包)</span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">共 {quota.workflows_total} 个</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border border-black/[0.04] dark:border-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(ratio)} ${ratio >= 0.8 ? 'animate-pulse' : ''}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {ratio >= 0.8 && (
                  <p className="mt-1.5 text-[11px] text-rose-500 font-medium">
                    仅剩 {quota.workflows_remaining} 个空位，建议尽快升级
                  </p>
                )}
              </div>
            )}

            {/* Tier comparison */}
            {!isUltra && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">各等级容量对比</div>
                <div className="flex flex-col gap-1">
                  {TIER_WORKFLOW_PLANS.map(plan => {
                    const isCurrent = plan.tier === quota.tier;
                    return (
                      <div
                        key={plan.tier}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-[12px] transition-colors
                          ${isCurrent
                            ? 'bg-slate-800 text-white font-medium dark:bg-slate-700'
                            : plan.highlight
                              ? 'bg-blue-50 border border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
                              : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50'
                          }`}
                      >
                        <div className="flex items-center gap-2">
                          {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />}
                          <span>{plan.label}</span>
                          {plan.highlight && !isCurrent && (
                            <span className="text-[10px] bg-blue-500 text-white rounded px-1 py-0.5 leading-none">推荐</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <span className={`font-semibold ${isCurrent ? 'text-white' : ''}`}>{plan.count}</span>
                          {!isCurrent && <span className="text-[11px] text-slate-400 dark:text-slate-500">{plan.price}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ultra: unlimited celebration */}
            {isUltra && (
              <div className="text-center py-3">
                <Crown className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300">Ultra 版不限工作流数量</p>
                <p className="text-[12px] text-slate-400 mt-1">尽情创建，空间永不受限</p>
              </div>
            )}

            {/* CTA section */}
            {!isUltra && (
              <div className="flex flex-col gap-2 pt-1 border-t border-dashed border-black/[0.06] dark:border-white/10">
                {upgradeTier ? (
                  <a
                    href="/upgrade"
                    className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-[13px] font-medium py-2.5 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors group"
                  >
                    <span>升级 {upgradeTier}，工作流扩容至 {upgradeTier === 'Pro' ? '50' : '200'} 个</span>
                    <ChevronRight className="h-4 w-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                  </a>
                ) : null}
                <a
                  href="/upgrade#addons"
                  className="text-center text-[12px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors py-1 underline underline-offset-2 decoration-slate-300 dark:decoration-slate-600"
                >
                  仅需扩容？购买工作流增值包 (+5/+10/+20 个)
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
