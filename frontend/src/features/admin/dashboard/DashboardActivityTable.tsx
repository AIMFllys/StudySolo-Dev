'use client';

import { motion } from 'framer-motion';
import type { RecentCallsResponse } from '@/types/usage';
import {
  EmptyState,
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

function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

export function DashboardActivityTable({ recentCalls, loading }: DashboardActivityTableProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717]"
    >
      <div className="border-b border-[#2e2e2e] bg-[#171717] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#232323]">
            <span className="material-symbols-outlined text-[#3ecf8e]">history</span>
          </div>
          <div>
            <h2 className="text-lg font-medium text-[#ededed]">最近真实调用</h2>
            <p className="text-[13px] text-[#8f8f8f]">追踪失败、Fallback 与平台级真实成本</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap text-[13px]">
          <thead>
            <tr className="border-b border-[#2e2e2e] bg-[#171717]">
              {HEADERS.map((header) => (
                <th key={header} className="px-6 py-3 font-medium text-[#ededed]">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e]">
            {loading ? (
              <TableSkeletonRows rows={8} cols={7} />
            ) : !recentCalls || recentCalls.calls.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <EmptyState title="暂无 AI 调用数据" description="当前时间范围内还没有采集到真实 Provider 调用。" />
                </td>
              </tr>
            ) : (
              recentCalls.calls.map((call) => (
                <tr key={call.id} className="transition-colors hover:bg-[#1f1f1f]">
                  <td className="px-6 py-4 font-mono text-[12px] text-[#8f8f8f]">{truncateId(call.id)}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#ededed]">
                      {call.source_type}
                      <span className="mx-1 text-[#555]">/</span>
                      <span className="text-[#8f8f8f] font-normal">{call.source_subtype}</span>
                    </div>
                    {call.is_fallback ? (
                      <span className="mt-1 inline-block rounded border border-amber-800/40 bg-amber-950/30 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                        FALLBACK
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#ededed]">
                      {call.provider}
                      <span className="mx-1 text-[#555]">/</span>
                      {call.model}
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#8f8f8f]">{call.vendor} · {call.billing_channel}</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge
                      label={call.status}
                      className={
                        call.status === 'success'
                          ? 'border-emerald-800/40 bg-emerald-950/30 text-emerald-400'
                          : 'border-rose-800/40 bg-rose-950/30 text-rose-400'
                      }
                    />
                  </td>
                  <td className="px-6 py-4 font-mono text-[12px] text-[#8f8f8f]">
                    {call.total_tokens.toLocaleString('zh-CN')}
                  </td>
                  <td className="px-6 py-4 font-medium text-[#ededed]">
                    {formatCny(call.cost_amount_cny)}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[#8f8f8f]">
                    {formatDateTime(call.started_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </motion.section>
  );
}
