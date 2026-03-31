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
    <div className="mx-auto min-h-full max-w-[1600px] space-y-6 px-8 py-8">
      <PageHeader
        title="审计日志"
        description={data ? `共 ${data.total.toLocaleString('zh-CN')} 条管理员审计记录` : '支持分页浏览与按操作类型筛选'}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition-all hover:shadow-md">
        <form
          className="flex flex-col gap-4 md:flex-row md:items-center"
          onSubmit={(event) => {
            event.preventDefault();
            submitQuery();
          }}
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">search</span>
            <input
              value={draftActionFilter}
              onChange={(event) => setDraftActionFilter(event.target.value)}
              placeholder="按操作类型筛选，例如 config_update"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            查询
          </button>
        </form>
      </section>

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
            <span>{error}</span>
          </div>
          <button 
            onClick={() => void fetchLogs()} 
            className="flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            重试
          </button>
        </div>
      ) : null}

      {!loading && !data ? (
        <EmptyState title="暂无审计数据" description="当前无法获取审计日志，请稍后重试。" />
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr),420px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    {['操作类型', '操作人', '目标资源', '发生时间'].map((header) => (
                      <th key={header} className="px-6 py-4 text-[11px] font-bold tracking-wider text-slate-500 uppercase whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <TableSkeletonRows rows={8} cols={4} />
                  ) : data && data.logs.length > 0 ? (
                    data.logs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer align-top transition-colors ${
                          selectedLog?.id === log.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">commit</span>
                            <span className="font-mono text-sm font-medium text-slate-900">{log.action}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">person</span>
                            {log.admin_username ?? log.admin_id ?? '系统'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                            {[log.target_type, log.target_id].filter(Boolean).join(' / ') || '—'}
                          </code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                            {formatDateTime(log.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8">
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
