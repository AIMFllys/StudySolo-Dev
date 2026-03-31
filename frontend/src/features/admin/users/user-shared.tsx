import type { ReactNode } from 'react';
import { TIER_BADGE, resolveBadgeStyle } from '@/features/admin/shared';

export const TIER_OPTIONS = [
  { value: 'free', label: '免费版' },
  { value: 'pro', label: '专业版' },
  { value: 'pro_plus', label: '专业增强版' },
  { value: 'ultra', label: '旗舰版' },
] as const;

export function TierBadge({ tier }: { tier: string }) {
  const badge = resolveBadgeStyle(TIER_BADGE, tier, tier);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium tracking-wide border ${badge.className}`}>
      {badge.label}
    </span>
  );
}

export function StatusBadgeWithDot({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium tracking-wide border ${
        isActive
          ? 'bg-emerald-950/30 text-emerald-400 border-emerald-800/40'
          : 'bg-red-950/30 text-red-400 border-red-800/40'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {isActive ? '正常' : '停用'}
    </span>
  );
}

export function InfoRow({ label, children, border = true }: { label: string; children: ReactNode; border?: boolean }) {
  return (
    <div className={`flex items-start justify-between py-3.5 ${border ? 'border-b border-[#2e2e2e] last:border-0' : ''}`}>
      <span className="text-[13px] font-medium text-[#8f8f8f]">{label}</span>
      <span className="text-[13px] font-medium text-[#ededed] text-right">{children}</span>
    </div>
  );
}
