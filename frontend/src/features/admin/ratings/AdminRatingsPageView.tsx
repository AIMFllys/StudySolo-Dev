'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/services/admin.service';
import type { PaginatedRatingList, RatingOverview, RatingScoreFilter } from '@/types/admin';
import { KpiCard, PageHeader } from '@/features/admin/shared';
import { AdminRatingsTable } from './AdminRatingsTable';

export function AdminRatingsPageView() {
  const [overview, setOverview] = useState<RatingOverview | null>(null);
  const [ratingList, setRatingList] = useState<PaginatedRatingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scoreFilter, setScoreFilter] = useState<RatingScoreFilter>('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ratingParam = scoreFilter ? `&rating=${scoreFilter}` : '';
      const [ov, list] = await Promise.all([
        adminFetch<RatingOverview>('/ratings/overview'),
        adminFetch<PaginatedRatingList>(`/ratings/details?page=${page}&page_size=20${ratingParam}`),
      ]);
      setOverview(ov);
      setRatingList(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载评分数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, scoreFilter]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const avgDisplay = overview?.avg_rating != null ? overview.avg_rating.toFixed(1) : '—';
  const distDisplay = overview
    ? Object.entries(overview.rating_distribution)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([score, count]) => `${score}★ ${count}`)
        .join('  ')
    : '';

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-6 px-8 py-8 md:px-12">
      <PageHeader
        title="用户反馈与评分"
        description={overview ? `共 ${overview.total_count} 条用户反馈` : '查看用户产品反馈与满意度评分'}
      />

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
            <span>{error}</span>
          </div>
          <button onClick={() => void fetchAll()} className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            重试
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="平均满意度" value={`${avgDisplay} / 5`} sub={overview ? `共 ${overview.total_count} 条反馈` : '加载中'} />
        <KpiCard label="评分分布" value={distDisplay || '—'} sub="按星级统计" />
        <KpiCard label="奖励已发放" value={overview ? String(overview.reward_applied_count) : '—'} sub="已成功发放会员奖励" />
      </div>

      <AdminRatingsTable
        loading={loading}
        ratingList={ratingList}
        page={page}
        scoreFilter={scoreFilter}
        onFilterChange={(filter) => { setScoreFilter(filter); setPage(1); }}
        onPageChange={setPage}
      />
    </div>
  );
}
