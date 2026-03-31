import type { PaginatedRatingList, RatingScoreFilter } from '@/types/admin';
import { EmptyState, Pagination, formatDate } from '@/features/admin/shared';

const STAR_LABELS: Record<number, string> = {
  1: '非常不满意',
  2: '不满意',
  3: '一般',
  4: '满意',
  5: '非常满意',
};

interface AdminRatingsTableProps {
  loading: boolean;
  ratingList: PaginatedRatingList | null;
  page: number;
  scoreFilter: RatingScoreFilter;
  onFilterChange: (value: RatingScoreFilter) => void;
  onPageChange: (page: number) => void;
}

export function AdminRatingsTable({
  loading,
  ratingList,
  page,
  scoreFilter,
  onFilterChange,
  onPageChange,
}: AdminRatingsTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
        <h2 className="text-base font-bold text-slate-900">反馈明细</h2>
        <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          {(['' as RatingScoreFilter, 5, 4, 3, 2, 1] as RatingScoreFilter[]).map((filter) => (
            <button
              key={filter === '' ? 'all' : filter}
              onClick={() => onFilterChange(filter)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                scoreFilter === filter
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {filter === '' ? '全部' : `${filter}★`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/50">
              {['用户', '评分', '问题类型', '反馈内容', '奖励', '时间'].map((header) => (
                <th key={header} className="px-6 py-3.5 text-left text-[11px] font-bold tracking-wider text-slate-500 uppercase">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              Array.from({ length: 5 }).map((_, row) => (
                <tr key={row}>
                  {Array.from({ length: 6 }).map((_, col) => (
                    <td key={col} className="px-6 py-4">
                      <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                    </td>
                  ))}
                </tr>
              ))
            ) : ratingList && ratingList.ratings.length > 0 ? (
              ratingList.ratings.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50/50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{item.nickname || '匿名用户'}</div>
                    <div className="text-xs text-slate-400">{item.email || item.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-slate-700">{item.rating}</span>
                      <span className="text-xs text-slate-400">{STAR_LABELS[item.rating] ?? ''}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.issue_type ? (
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/10">
                        {item.issue_type}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="max-w-xs px-6 py-4 text-sm text-slate-600">
                    <span className="line-clamp-2">{item.content}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                      item.reward_applied
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/20'
                        : 'bg-slate-50 text-slate-500 ring-slate-500/10'
                    }`}>
                      {item.reward_applied ? `+${item.reward_days}天` : '未发放'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">{formatDate(item.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-8">
                  <EmptyState title="暂无反馈数据" description="当前筛选条件下没有用户反馈记录。" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {ratingList && (
        <div className="border-t border-slate-100 p-2">
          <Pagination
            page={page}
            totalPages={ratingList.total_pages}
            total={ratingList.total}
            loading={loading}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}
