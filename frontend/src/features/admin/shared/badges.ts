export interface BadgeStyle {
  label: string;
  className: string;
}

export type BadgeMap = Record<string, BadgeStyle>;

export function resolveBadgeStyle(
  map: BadgeMap,
  key: string | null | undefined,
  fallbackLabel?: string,
): BadgeStyle {
  if (key && map[key]) return map[key];
  return {
    label: fallbackLabel ?? key ?? '未知',
    className: 'bg-[#232323] text-[#8f8f8f] ring-[#2e2e2e]',
  };
}

export const TIER_BADGE: BadgeMap = {
  free: { label: '免费版', className: 'bg-[#232323] text-[#8f8f8f] ring-[#2e2e2e]' },
  pro: { label: '专业版', className: 'bg-blue-950/50 text-blue-400 ring-blue-800/40' },
  pro_plus: { label: '增强版', className: 'bg-indigo-950/50 text-indigo-400 ring-indigo-800/40' },
  ultra: { label: '旗舰版', className: 'bg-amber-950/50 text-amber-400 ring-amber-800/40' },
};

export const NOTICE_TYPE_BADGE: BadgeMap = {
  system: { label: '系统公告', className: 'bg-blue-950/50 text-blue-400 ring-blue-800/40' },
  feature: { label: '功能更新', className: 'bg-emerald-950/50 text-emerald-400 ring-emerald-800/40' },
  promotion: { label: '活动推广', className: 'bg-amber-950/50 text-amber-400 ring-amber-800/40' },
  education: { label: '教育资讯', className: 'bg-violet-950/50 text-violet-400 ring-violet-800/40' },
  changelog: { label: '版本变更', className: 'bg-cyan-950/50 text-cyan-400 ring-cyan-800/40' },
  maintenance: { label: '维护通知', className: 'bg-red-950/50 text-red-400 ring-red-800/40' },
};

export const NOTICE_STATUS_BADGE: BadgeMap = {
  draft: { label: '草稿', className: 'bg-[#232323] text-[#8f8f8f] ring-[#2e2e2e]' },
  published: { label: '已发布', className: 'bg-emerald-950/50 text-emerald-400 ring-emerald-800/40' },
  archived: { label: '已归档', className: 'bg-[#232323] text-[#666] ring-[#2e2e2e]' },
};
