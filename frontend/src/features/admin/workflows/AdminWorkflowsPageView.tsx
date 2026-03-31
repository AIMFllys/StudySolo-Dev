'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { adminFetch } from '@/services/admin.service';
import type {
  ErrorWorkflowsResponse,
  RunningWorkflowsResponse,
  WorkflowStatsResponse,
  WorkflowTimeRange,
} from '@/types/admin';
import {
  KpiCard,
  PageHeader,
  TableSkeletonRows,
  formatDateTime,
  formatDuration,
  truncateId,
} from '@/features/admin/shared';

const TIME_RANGE_OPTIONS = [
  ['7d', '近 7 天'],
  ['30d', '近 30 天'],
  ['90d', '近 90 天'],
] as const satisfies readonly [WorkflowTimeRange, string][];

const RUNNING_HEADERS = ['运行 ID', '工作流 ID', '用户 ID', '开始时间', '当前进度', '已耗时'];
const ERROR_HEADERS = ['运行 ID', '工作流 ID', '用户 ID', '状态', '开始时间', '总耗时'];

interface WorkflowTableSectionProps {
  title: string;
  total: number;
  headers: string[];
  loading: boolean;
  emptyText: string;
  emptyColSpan: number;
  accentClassName: string;
  children: ReactNode;
  icon: string;
}

function WorkflowTableSection({
  title,
  total,
  headers,
  loading,
  emptyText,
  emptyColSpan,
  accentClassName,
  children,
  icon,
}: WorkflowTableSectionProps) {
  return (
    <section className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717]">
      <div className={`flex items-center justify-between border-b border-[#2e2e2e] px-6 py-4 bg-[#171717] ${accentClassName}`}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] opacity-70">{icon}</span>
          <h2 className="text-[13px] font-medium tracking-wide">{title}</h2>
        </div>
        <span className="rounded-full bg-[#232323] px-2.5 py-0.5 text-[12px] font-medium text-[#8f8f8f]">
          共 {total} 条
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#2e2e2e] bg-[#171717]">
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-6 py-3.5 text-[12px] font-medium tracking-wider text-[#666] uppercase"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2e2e2e]">
            {loading ? (
              <TableSkeletonRows rows={3} cols={emptyColSpan} />
            ) : (
              children || (
                <tr>
                  <td
                    colSpan={emptyColSpan}
                    className="bg-[#171717] px-6 py-12 text-center text-[13px] font-medium tracking-wide text-[#8f8f8f]"
                  >
                    {emptyText}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function AdminWorkflowsPageView() {
  const [timeRange, setTimeRange] = useState<WorkflowTimeRange>('7d');
  const [statsData, setStatsData] = useState<WorkflowStatsResponse | null>(null);
  const [runningData, setRunningData] = useState<RunningWorkflowsResponse | null>(null);
  const [errorsData, setErrorsData] = useState<ErrorWorkflowsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [stats, running, errors] = await Promise.all([
        adminFetch<WorkflowStatsResponse>(`/workflows/stats?time_range=${timeRange}`),
        adminFetch<RunningWorkflowsResponse>('/workflows/running'),
        adminFetch<ErrorWorkflowsResponse>('/workflows/errors'),
      ]);
      setStatsData(stats);
      setRunningData(running);
      setErrorsData(errors);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载工作流监控数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const stats = statsData?.stats;

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-5 px-6 py-6">
      <PageHeader
        title="工作流监控"
        description={
          runningData
            ? `当前有 ${runningData.total} 个运行实例正在执行`
            : '查看工作流运行状态、失败记录与时间范围统计。'
        }
        action={
          <div className="flex items-center gap-1 overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717] p-1">
            {TIME_RANGE_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={`rounded-md px-4 py-1.5 text-[12px] font-medium tracking-wide transition-all ${
                  timeRange === value
                    ? 'bg-[#232323] text-[#3ecf8e]'
                    : 'text-[#8f8f8f] hover:text-[#ededed]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <div className="flex items-center justify-between rounded-md border border-red-800/40 bg-red-950/30 p-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-red-400">error</span>
            <span className="text-[13px] font-medium tracking-wide text-red-400">系统错误：{error}</span>
          </div>
          <button
            onClick={() => void fetchAll()}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-red-400 transition-colors hover:bg-red-950/50"
          >
            重新加载
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-md border border-[#2e2e2e] bg-[#171717] p-6" />
          ))
        ) : stats ? (
          <>
            <KpiCard label="总执行次数" value={stats.total_runs.toLocaleString('zh-CN')} sub={`统计范围 ${timeRange}`} />
            <KpiCard label="成功率" value={`${(stats.success_rate * 100).toFixed(1)}%`} sub={`已完成 ${stats.completed}`} />
            <KpiCard label="平均执行时长" value={formatDuration(stats.avg_duration_seconds)} sub="仅统计已完成任务" />
            <KpiCard label="Token 总消耗" value={stats.total_tokens_used.toLocaleString('zh-CN')} sub={`统计范围 ${timeRange}`} />
          </>
        ) : null}
      </div>

      {stats ? (
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['已完成执行', stats.completed, 'border-emerald-800/40 bg-emerald-950/30 text-emerald-400', 'check_circle'],
            ['运行中任务', stats.running, 'border-[#3ecf8e]/30 bg-[#3ecf8e]/10 text-[#3ecf8e]', 'cycle'],
            ['失败任务', stats.failed, 'border-red-800/40 bg-red-950/30 text-red-400', 'cancel'],
          ].map(([label, value, accentClassName, icon]) => (
            <section
              key={label as string}
              className={`flex flex-col items-center justify-center rounded-md border p-6 transition-all ${accentClassName}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] opacity-70">{icon}</span>
                <p className="text-[12px] font-medium tracking-wider uppercase opacity-80">
                  {label}
                </p>
              </div>
              <p className="text-4xl font-extrabold tracking-tight">{value}</p>
            </section>
          ))}
        </div>
      ) : null}

      <WorkflowTableSection
        title="运行中实例"
        total={runningData?.total ?? 0}
        headers={RUNNING_HEADERS}
        loading={loading}
        emptyText="暂无运行中任务"
        emptyColSpan={6}
        icon="cycle"
        accentClassName="text-[#3ecf8e]"
      >
        {runningData?.running.length
          ? runningData.running.map((workflow) => (
              <tr
                key={workflow.id}
                className="group transition-colors hover:bg-[#1f1f1f]"
              >
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-[#ededed]">
                  #{truncateId(workflow.id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-[#8f8f8f]">
                  {truncateId(workflow.workflow_id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-[#8f8f8f]">
                  {truncateId(workflow.user_id)}
                </td>
                <td className="px-6 py-4 text-[13px] text-[#8f8f8f]">
                  {formatDateTime(workflow.started_at)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium text-[#8f8f8f]">
                  {workflow.total_steps ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#232323]">
                        <div
                          className="h-full rounded-full bg-[#3ecf8e] transition-all"
                          style={{ width: `${((workflow.current_step ?? 0) / workflow.total_steps) * 100}%` }}
                        />
                      </div>
                      <span>{`${workflow.current_step ?? 0}/${workflow.total_steps}`}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[#3ecf8e]">
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-[#3ecf8e]" />
                      {workflow.current_node ?? '等待中'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-[13px] font-medium text-[#8f8f8f]">
                  {formatDuration(workflow.elapsed_seconds)}
                </td>
              </tr>
            ))
          : null}
      </WorkflowTableSection>

      <WorkflowTableSection
        title="异常记录"
        total={errorsData?.total ?? 0}
        headers={ERROR_HEADERS}
        loading={loading}
        emptyText="暂无异常任务"
        emptyColSpan={6}
        icon="warning"
        accentClassName="text-red-400"
      >
        {errorsData?.errors.length
          ? errorsData.errors.map((workflow) => (
              <tr
                key={workflow.id}
                className="group transition-colors hover:bg-[#1f1f1f]"
              >
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-[#ededed]">
                  #{truncateId(workflow.id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-[#8f8f8f]">
                  {truncateId(workflow.workflow_id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-[#8f8f8f]">
                  {truncateId(workflow.user_id)}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-md border border-red-800/40 bg-red-950/30 px-2 py-1 text-[11px] font-medium tracking-wide text-red-400">
                    {workflow.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[13px] text-[#8f8f8f]">
                  {formatDateTime(workflow.started_at)}
                </td>
                <td className="px-6 py-4 text-[13px] font-medium text-[#8f8f8f]">
                  {formatDuration(workflow.elapsed_seconds)}
                </td>
              </tr>
            ))
          : null}
      </WorkflowTableSection>
    </div>
  );
}
