'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { RecentCallsResponse } from '@/types/usage';
import {
  EmptyState,
  Pagination,
  StatusBadge,
  TableSkeletonRows,
  formatDateTime,
  truncateId,
} from '@/features/admin/shared';

interface DashboardActivityTableProps {
  recentCalls: RecentCallsResponse | null;
  loading: boolean;
}

const HEADERS = ['调用 ID', '账本来源', '模型', '状态', 'Tokens', '费用', '开始时间'];
const PAGE_SIZE = 10;

function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

export function DashboardActivityTable({ recentCalls, loading }: DashboardActivityTableProps) {
  const [page, setPage] = useState(1);

  const allCalls = useMemo(() => recentCalls?.calls ?? [], [recentCalls]);
  const total = allCalls.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagedCalls = useMemo(
    () => allCalls.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [allCalls, page],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[18px] text-primary">history</span>
          <h2 className="text-[14px] font-medium text-foreground">最近真实调用</h2>
        </div>
        <span className="text-[11px] text-muted-foreground/60">共 {total} 条</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {HEADERS.map((header) => (
                <th key={header} className="px-5 py-2.5 text-[11px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <TableSkeletonRows rows={PAGE_SIZE} cols={7} />
            ) : pagedCalls.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <EmptyState title="暂无 AI 调用数据" description="当前时间范围内还没有采集到真实 Provider 调用。" />
                </td>
              </tr>
            ) : (
              pagedCalls.map((call) => (
                <tr key={call.id} className="transition-colors hover:bg-muted">
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{truncateId(call.id)}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">
                      {call.source_type}
                      <span className="mx-1 text-muted-foreground/60">/</span>
                      <span className="text-muted-foreground font-normal">{call.source_subtype}</span>
                    </div>
                    {call.is_fallback ? (
                      <span className="mt-0.5 inline-block rounded border border-amber-800/40 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        FALLBACK
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-foreground">
                      {call.provider}<span className="mx-1 text-muted-foreground/60">/</span>{call.model}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{call.vendor} · {call.billing_channel}</div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge
                      label={call.status}
                      className={call.status === 'success' ? 'border-accent/30 bg-accent/10 text-accent' : 'border-rose-800/40 bg-rose-950/30 text-rose-400'}
                    />
                  </td>
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{call.total_tokens.toLocaleString('zh-CN')}</td>
                  <td className="px-5 py-3 font-medium text-foreground">{formatCny(call.cost_amount_cny)}</td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground">{formatDateTime(call.started_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} loading={loading} onPageChange={setPage} />
    </motion.section>
  );
}
