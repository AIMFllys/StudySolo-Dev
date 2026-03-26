'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuditLogs } from '@/services/admin.service';
import type { AuditLogItem, PaginatedAuditLogs } from '@/types/admin';
import { EmptyState, PageHeader, Pagination, TableSkeletonRows, formatDateTime } from '@/features/admin/shared';
import { AuditDetailPane } from './AuditDetailPane';

export function AdminAuditPageView() {
  const [data, setData] = useState<PaginatedAuditLogs | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [draftActionFilter, setDraftActionFilter] = useState('');
  const [appliedActionFilter, setAppliedActionFilter] = useState('');
  const [queryVersion, setQueryVersion] = useState(0);

  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('page_size', '20');
    if (appliedActionFilter) searchParams.set('action', appliedActionFilter);
    return searchParams;
  }, [appliedActionFilter, page]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAuditLogs(params);
      setData(result);
      setSelectedLog((current) => result.logs.find((log) => log.id === current?.id) ?? result.logs[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载审计日志失败');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs, queryVersion]);

  const submitQuery = useCallback(() => {
    setPage(1);
    setAppliedActionFilter(draftActionFilter.trim());
    setQueryVersion((current) => current + 1);
  }, [draftActionFilter]);

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-6 bg-[#f4f4f0] px-8 py-8">
      <PageHeader
        title="审计日志"
        description={data ? `共 ${data.total.toLocaleString('zh-CN')} 条管理员审计记录` : '支持分页浏览与按操作类型筛选'}
      />

      <section className="rounded-none border border-[#c4c6cf] bg-[#f4f4f0] p-5 shadow-sm">
        <form
          className="flex flex-col gap-4 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuery();
          }}
        >
          <input
            value={draftActionFilter}
            onChange={(event) => setDraftActionFilter(event.target.value)}
            placeholder="按操作类型筛选，例如 config_update"
            className="flex-1 rounded-none border border-[#c4c6cf] bg-[#f4f4f0] px-3 py-2 text-sm text-[#002045] shadow-sm focus:border-[#002045] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-none border border-[#002045] bg-[#002045] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            查询
          </button>
        </form>
      </section>

      {error ? (
        <div className="rounded-none border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <button onClick={() => void fetchLogs()} className="text-xs underline">
              重新加载
            </button>
          </div>
        </div>
      ) : null}

      {!loading && !data ? (
        <EmptyState title="暂无审计数据" description="当前无法获取审计日志，请稍后重试。" />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr),420px]">
          <div className="overflow-hidden rounded-none border border-[#c4c6cf] bg-[#f4f4f0] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#c4c6cf]">
                    {['操作类型', '操作人', '目标资源', '发生时间'].map((header) => (
                      <th key={header} className="px-5 py-4 font-mono text-[10px] tracking-widest text-[#002045]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeletonRows rows={8} cols={4} />
                  ) : data && data.logs.length > 0 ? (
                    data.logs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer border-b border-[#ddd8cf] transition-colors last:border-b-0 ${
                          selectedLog?.id === log.id ? 'bg-[#ebe9df]' : 'hover:bg-[#ebe9df]'
                        }`}
                      >
                        <td className="px-5 py-4 text-sm text-[#002045]">{log.action}</td>
                        <td className="px-5 py-4 text-sm text-[#74777f]">{log.admin_username ?? log.admin_id ?? '系统'}</td>
                        <td className="px-5 py-4 text-sm text-[#74777f]">
                          {[log.target_type, log.target_id].filter(Boolean).join(' / ') || '—'}
                        </td>
                        <td className="px-5 py-4 font-mono text-xs text-[#74777f]">{formatDateTime(log.created_at)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-6">
                        <EmptyState title="暂无匹配日志" description="当前筛选条件下没有审计记录。" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={data?.total_pages ?? 1}
              total={data?.total}
              loading={loading}
              onPageChange={setPage}
            />
          </div>

          <AuditDetailPane log={selectedLog} />
        </div>
      )}
    </div>
  );
}
