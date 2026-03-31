'use client';

import { EmptyState, PageHeader } from '@/features/admin/shared';

const DEFERRED_ITEMS = [
  {
    icon: 'hourglass_empty',
    label: '范围状态',
    value: '延后实施',
    description: '本期不新增 billing API、数据库表或统计口径。',
  },
  {
    icon: 'pause_circle',
    label: '当前策略',
    value: '保持占位',
    description: '不再继续维护 mock 收入数据，避免与真实后端继续漂移。',
  },
  {
    icon: 'skip_next',
    label: '后续入口',
    value: '下一阶段',
    description: '待 dashboard、users、config、audit 稳定后再启动计费建设。',
  },
];

export function AdminBillingPageView() {
  return (
    <div className="mx-auto min-h-full max-w-6xl space-y-5 px-6 py-6">
      <PageHeader
        title="计费中心"
        description="计费与收入统计不在 Wave 1 范围内，本阶段仅保留中文占位页与后续实施约束。"
      />

      <div className="grid gap-5 md:grid-cols-3">
        {DEFERRED_ITEMS.map((item) => (
          <section
            key={item.label}
            className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6 transition-all"
          >
            <div className="flex items-center gap-2 text-[#666] mb-3">
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <p className="text-[11px] font-medium tracking-wider uppercase">
                {item.label}
              </p>
            </div>
            
            <h2 className="text-xl font-semibold text-[#ededed]">
              {item.value}
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-[#8f8f8f]">
              {item.description}
            </p>
          </section>
        ))}
      </div>

      <section className="rounded-md border border-[#2e2e2e] bg-[#171717] p-8">
        <EmptyState
          title="计费页暂不开放"
          description="如需进入下一阶段，应先明确 Supabase 账单相关表结构、收入口径、导出需求与权限边界。"
        />
      </section>
    </div>
  );
}
