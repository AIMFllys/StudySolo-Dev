import { useRouter } from 'next/navigation';
import type { PaginatedNoticeList } from '@/types/admin';
import {
  NOTICE_STATUS_BADGE,
  NOTICE_TYPE_BADGE,
  Pagination,
  StatusBadge,
  TableSkeletonRows,
  formatDate,
  resolveBadgeStyle,
} from '@/features/admin/shared';

interface AdminNoticesTableProps {
  data: PaginatedNoticeList | null;
  loading: boolean;
  page: number;
  actionLoading: string | null;
  onPageChange: (page: number) => void;
  onPublish: (noticeId: string) => void;
  onDelete: (noticeId: string, title: string) => void;
}

export function AdminNoticesTable({
  data,
  loading,
  page,
  actionLoading,
  onPageChange,
  onPublish,
  onDelete,
}: AdminNoticesTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717]">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#2e2e2e] bg-[#171717]">
              <th className="px-6 py-4 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">标题</th>
              <th className="px-6 py-4 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">类型</th>
              <th className="px-6 py-4 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">状态</th>
              <th className="px-6 py-4 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">创建时间</th>
              <th className="px-6 py-4 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">发布时间</th>
              <th className="px-6 py-4 text-left text-[11px] font-medium tracking-wider text-[#666] uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e] bg-[#171717]">
            {loading ? (
              <TableSkeletonRows rows={8} cols={6} />
            ) : !data || data.notices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-[13px] text-[#8f8f8f]">
                  暂无公告
                </td>
              </tr>
            ) : (
              data.notices.map((notice) => {
                const typeBadge = resolveBadgeStyle(NOTICE_TYPE_BADGE, notice.type, notice.type);
                const statusBadge = resolveBadgeStyle(NOTICE_STATUS_BADGE, notice.status, notice.status);

                return (
                  <tr
                    key={notice.id}
                    onClick={() => router.push(`/admin-analysis/notices/${notice.id}/edit`)}
                    className="group cursor-pointer transition-colors hover:bg-[#1f1f1f]"
                  >
                    <td className="max-w-xs px-6 py-4 text-[13px] font-medium text-[#ededed]">
                      <span className="line-clamp-1">{notice.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge label={typeBadge.label} className={typeBadge.className} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge label={statusBadge.label} className={statusBadge.className} />
                    </td>
                    <td className="px-6 py-4 text-[12px] font-medium text-[#8f8f8f]">{formatDate(notice.created_at)}</td>
                    <td className="px-6 py-4 text-[12px] font-medium text-[#8f8f8f]">{formatDate(notice.published_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        {notice.status === 'draft' ? (
                          <>
                            <button
                              onClick={() => onPublish(notice.id)}
                              disabled={actionLoading === notice.id}
                              className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-3 py-1.5 text-[12px] font-medium text-emerald-400 transition-colors hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {actionLoading === notice.id ? '...' : '发布'}
                            </button>
                            <button
                              onClick={() => onDelete(notice.id, notice.title)}
                              disabled={actionLoading === notice.id}
                              className="rounded-lg border border-red-800/40 bg-red-950/30 px-3 py-1.5 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              删除
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => router.push(`/admin-analysis/notices/${notice.id}/edit`)}
                            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#3ecf8e] transition-colors hover:bg-[#1f1f1f]"
                          >
                            编辑
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-[#2e2e2e] p-2">
        <Pagination
          page={page}
          totalPages={data?.total_pages ?? 1}
          total={data?.total}
          loading={loading}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
