'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/services/admin.service';
import type {
  MemberTierFilter as TierFilter,
  PaginatedMemberList,
  RevenueStats,
  TierStats,
} from '@/types/admin';
import { AdminSelect, EmptyState, KpiCard, PageHeader, Pagination, formatDate } from '@/features/admin/shared';
import { TierBadge } from '@/features/admin/users/user-shared';

const TIER_OPTIONS: { value: TierFilter; label: string }[] = [
  { value: '', label: '全部付费会员' },
  { value: 'pro', label: '专业版' },
  { value: 'pro_plus', label: '专业增强版' },
  { value: 'ultra', label: '旗舰版' },
];

export function AdminMembersPageView() {
  const [tierStats, setTierStats] = useState<TierStats | null>(null);
  const [memberList, setMemberList] = useState<PaginatedMemberList | null>(null);
  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<TierFilter>('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tierParam = tierFilter ? `&tier=${tierFilter}` : '';
      const [stats, list, rev] = await Promise.all([
        adminFetch<TierStats>('/members/stats'),
        adminFetch<PaginatedMemberList>(`/members/list?page=${page}&page_size=20${tierParam}`),
        adminFetch<RevenueStats>('/members/revenue'),
      ]);
      setTierStats(stats);
      setMemberList(list);
      setRevenue(rev);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载会员数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, tierFilter]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-5 px-6 py-6">
      <PageHeader
        title="会员管理"
        description={
          tierStats ? `共 ${tierStats.total.toLocaleString('zh-CN')} 位用户，其中 ${tierStats.paid_total.toLocaleString('zh-CN')} 位为付费用户` : '查看会员分布与收入概况'
        }
      />

      {error ? (
        <div className="flex items-center justify-between rounded-md border border-red-800/40 bg-red-950/30 p-4 text-[13px] text-red-400">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
            <span>{error}</span>
          </div>
          <button 
            onClick={() => void fetchAll()} 
            className="flex items-center gap-1 text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            重试
          </button>
        </div>
      ) : null}

      {tierStats ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiCard label="免费版用户" value={tierStats.free.toLocaleString()} />
          <KpiCard label="专业版用户" value={tierStats.pro.toLocaleString()} />
          <KpiCard label="专业增强版" value={tierStats.pro_plus.toLocaleString()} />
          <KpiCard label="旗舰版用户" value={tierStats.ultra.toLocaleString()} />
        </div>
      ) : null}

      {revenue ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard label="月经常性收入" value={`¥ ${revenue.mrr.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} />
          <KpiCard label="年经常性收入" value={`¥ ${revenue.arr.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} />
          <KpiCard label="ARPU" value={`¥ ${revenue.arpu.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`} sub={`有效订阅 ${revenue.active_subscriptions}`} />
        </div>
      ) : null}

      <section className="rounded-md border border-[#2e2e2e] bg-[#171717] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-[#3ecf8e]">star</span>
            <h2 className="text-lg font-semibold text-[#ededed]">付费会员列表</h2>
          </div>
          <AdminSelect
            value={tierFilter}
            options={TIER_OPTIONS}
            onChange={(event) => {
              setTierFilter(event.target.value as TierFilter);
              setPage(1);
            }}
          />
        </div>

        <div className="overflow-x-auto rounded-md border border-[#2e2e2e]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#2e2e2e] bg-[#171717]">
                {['邮箱', '会员等级', '订阅状态', '订阅开始', '订阅结束'].map((header) => (
                  <th key={header} className="px-6 py-4 text-[11px] font-medium tracking-wider text-[#666] uppercase whitespace-nowrap">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2e2e2e]">
              {loading ? (
                Array.from({ length: 5 }).map((_, row) => (
                  <tr key={row}>
                    {Array.from({ length: 5 }).map((_, col) => (
                      <td key={col} className="px-6 py-5">
                        <div className="h-4 w-24 animate-pulse rounded bg-[#232323]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : memberList && memberList.members.length > 0 ? (
                memberList.members.map((member) => (
                  <tr key={member.user_id} className="align-top transition-colors hover:bg-[#1f1f1f]">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#232323] text-[#8f8f8f]">
                          <span className="material-symbols-outlined text-[16px]">person</span>
                        </div>
                        <span className="text-[13px] font-medium text-[#ededed]">{member.email ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <TierBadge tier={member.tier} />
                    </td>
                    <td className="px-6 py-5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${
                        member.subscription_status === 'active' 
                          ? 'bg-emerald-950/30 text-emerald-400'
                          : member.subscription_status === 'canceled'
                          ? 'bg-amber-950/30 text-amber-400'
                          : 'bg-[#171717] text-[#8f8f8f]'
                      }`}>
                        {member.subscription_status ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#8f8f8f]">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {formatDate(member.subscription_start)}
                      </div>
                    </td>
                    <td className="px-6 py-5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-[12px] text-[#8f8f8f]">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {formatDate(member.subscription_end)}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-8">
                    <EmptyState title="暂无付费会员" description="当前筛选条件下没有付费会员记录。" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-center">
          <Pagination
            page={page}
            totalPages={memberList?.total_pages ?? 1}
            total={memberList?.total}
            loading={loading}
            onPageChange={setPage}
          />
        </div>
      </section>
    </div>
  );
}
