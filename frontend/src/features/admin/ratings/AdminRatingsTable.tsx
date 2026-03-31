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
    <div className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717]">
      <div className="flex items-center justify-between border-b border-[#2e2e2e] px-6 py-4 bg-[#171717]">
        <h2 className="text-[14px] font-semibold text-[#ededed]">反馈明细</h2>
        <div className="flex items-center rounded-lg border border-[#2e2e2e] bg-[#232323] p-0.5">
          {(['' as RatingScoreFilter, 5, 4, 3, 2, 1] as RatingScoreFilter[]).map((filter) => (
            <button
              key={filter === '' ? 'all' : filter}
              onClick={() => onFilterChange(filter)}
              className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                scoreFilter === filter
                  ? 'bg-[#171717] text-[#ededed]'
                  : 'text-[#8f8f8f] hover:text-[#ededed]'
              }`}
            >
              {filter === '' ? '全部' : `${filter}★`}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#2e2e2e] bg-[#171717]">
              {['用户', '评分', '问题类型', '反馈内容', '奖励', '时间'].map((header) => (
                <th key={header} className="px-6 py-3.5 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e] bg-[#171717]">
            {loading ? (
              Array.from({ length: 5 }).map((_, row) => (
                <tr key={row}>
                  {Array.from({ length: 6 }).map((_, col) => (
                    <td key={col} className="px-6 py-4">
                      <div className="h-4 w-20 animate-pulse rounded bg-[#232323]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : ratingList && ratingList.ratings.length > 0 ? (
              ratingList.ratings.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-[#1f1f1f]">
                  <td className="px-6 py-4">
                    <div className="text-[13px] font-medium text-[#ededed]">{item.nickname || '匿名用户'}</div>
                    <div className="text-[12px] text-[#666]">{item.email || item.user_id.slice(0, 8)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[13px] font-medium text-[#8f8f8f]">{item.rating}</span>
                      <span className="text-[12px] text-[#666]">{STAR_LABELS[item.rating] ?? ''}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {item.issue_type ? (
                      <span className="inline-flex items-center rounded-md bg-[#232323] px-2 py-1 text-[12px] font-medium text-[#8f8f8f]">
                        {item.issue_type}
                      </span>
                    ) : <span className="text-[#555]">—</span>}
                  </td>
                  <td className="max-w-xs px-6 py-4 text-[13px] text-[#8f8f8f]">
                    <span className="line-clamp-2">{item.content}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium ${
                      item.reward_applied
                        ? 'bg-emerald-950/30 text-emerald-400'
                        : 'bg-[#171717] text-[#8f8f8f]'
                    }`}>
                      {item.reward_applied ? `+${item.reward_days}天` : '未发放'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[12px] font-medium text-[#8f8f8f] whitespace-nowrap">{formatDate(item.created_at)}</td>
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
        <div className="border-t border-[#2e2e2e] p-2">
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
