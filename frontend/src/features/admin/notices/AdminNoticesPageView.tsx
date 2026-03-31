'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/services/admin.service';
import type {
  NoticeStatusFilter,
  NoticeTypeFilter,
  PaginatedNoticeList,
} from '@/types/admin';
import {
  AdminSelect,
  PageHeader,
  buildPaginationParams,
} from '@/features/admin/shared';
import { AdminNoticesTable } from './AdminNoticesTable';

const TYPE_OPTIONS: { value: NoticeTypeFilter; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'system', label: '系统公告' },
  { value: 'feature', label: '功能更新' },
  { value: 'promotion', label: '活动推广' },
  { value: 'education', label: '教育通知' },
  { value: 'changelog', label: '更新日志' },
  { value: 'maintenance', label: '维护公告' },
];

const STATUS_OPTIONS: { value: NoticeStatusFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
];

export function AdminNoticesPageView() {
  const router = useRouter();

  const [data, setData] = useState<PaginatedNoticeList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<NoticeTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<NoticeStatusFilter>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter]);

  const queryString = useMemo(() => {
    const params = buildPaginationParams(page, 20);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    return params.toString();
  }, [page, statusFilter, typeFilter]);

  async function fetchNotices() {
    setLoading(true);
    setError(null);
    try {
      const result = await adminFetch<PaginatedNoticeList>(`/notices?${queryString}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载公告失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchNotices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  async function handlePublish(noticeId: string) {
    setActionLoading(noticeId);
    try {
      await adminFetch(`/notices/${noticeId}/publish`, { method: 'POST' });
      await fetchNotices();
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布公告失败');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(noticeId: string, title: string) {
    const confirmed = window.confirm(`确认删除公告"${title}"吗？删除后不可恢复。`);
    if (!confirmed) return;

    setActionLoading(noticeId);
    try {
      await adminFetch(`/notices/${noticeId}`, { method: 'DELETE' });
      await fetchNotices();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除公告失败');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-5 px-6 py-6">
      <PageHeader
        title="公告管理"
        description={data ? `共 ${data.total.toLocaleString('zh-CN')} 条公告` : '查看和维护站内公告'}
        action={
          <button
            onClick={() => router.push('/admin-analysis/notices/create')}
            className="flex items-center gap-2 rounded-md bg-[#3ecf8e] px-4 py-2 text-[13px] font-medium text-[#171717] transition-all hover:bg-[#2db87a] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            新建公告
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <AdminSelect
          value={typeFilter}
          options={TYPE_OPTIONS}
          onChange={(event) => setTypeFilter(event.target.value as NoticeTypeFilter)}
        />

        <AdminSelect
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(event) => setStatusFilter(event.target.value as NoticeStatusFilter)}
        />
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-md border border-red-800/40 bg-red-950/30 p-4 text-[13px] text-red-400">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
            <span>{error}</span>
          </div>
          <button 
            onClick={() => void fetchNotices()} 
            className="flex items-center gap-1 text-[12px] font-medium text-red-400 hover:text-red-300 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            重试
          </button>
        </div>
      ) : null}

      <AdminNoticesTable
        data={data}
        loading={loading}
        page={page}
        actionLoading={actionLoading}
        onPageChange={setPage}
        onPublish={(id) => {
          void handlePublish(id);
        }}
        onDelete={(id, title) => {
          void handleDelete(id, title);
        }}
      />
    </div>
  );
}
