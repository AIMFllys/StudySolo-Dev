'use client';

import { useCallback, useEffect, useState } from 'react';
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
  formatDateTime,
  formatDuration,
  truncateId,
} from '@/features/admin/shared';
import { WorkflowTableSection } from './WorkflowTableSection';

const TIME_RANGE_OPTIONS = [
  ['7d', '近 7 天'],
  ['30d', '近 30 天'],
  ['90d', '近 90 天'],
] as const satisfies readonly [WorkflowTimeRange, string][];

const RUNNING_HEADERS = ['运行 ID', '工作流 ID', '用户 ID', '开始时间', '当前进度', '已耗时'];
const ERROR_HEADERS = ['运行 ID', '工作流 ID', '用户 ID', '状态', '开始时间', '总耗时'];

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
          <div className="flex items-center gap-1 overflow-hidden rounded-md border border-border bg-card p-1">
            {TIME_RANGE_OPTIONS.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTimeRange(value)}
                className={`rounded-md px-4 py-1.5 text-[12px] font-medium tracking-wide transition-all ${
                  timeRange === value
                    ? 'bg-secondary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-destructive">error</span>
            <span className="text-[13px] font-medium tracking-wide text-destructive">系统错误：{error}</span>
          </div>
          <button
            onClick={() => void fetchAll()}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            重新加载
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 rounded-md border border-border bg-card p-6" />
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
            ['已完成执行', stats.completed, 'border-accent/30 bg-accent/10 text-accent', 'check_circle'],
            ['运行中任务', stats.running, 'border-primary/30 bg-primary/10 text-primary', 'cycle'],
            ['失败任务', stats.failed, 'border-destructive/30 bg-destructive/10 text-destructive', 'cancel'],
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
        accentClassName="text-primary"
      >
        {runningData?.running.length
          ? runningData.running.map((workflow) => (
              <tr
                key={workflow.id}
                className="group transition-colors hover:bg-muted"
              >
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-foreground">
                  #{truncateId(workflow.id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {truncateId(workflow.workflow_id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {truncateId(workflow.user_id)}
                </td>
                <td className="px-6 py-4 text-[13px] text-muted-foreground">
                  {formatDateTime(workflow.started_at)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium text-muted-foreground">
                  {workflow.total_steps ? (
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${((workflow.current_step ?? 0) / workflow.total_steps) * 100}%` }}
                        />
                      </div>
                      <span>{`${workflow.current_step ?? 0}/${workflow.total_steps}`}</span>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-primary">
                      <span className="h-1.5 w-1.5 rounded-full animate-pulse bg-primary" />
                      {workflow.current_node ?? '等待中'}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-[13px] font-medium text-muted-foreground">
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
        accentClassName="text-destructive"
      >
        {errorsData?.errors.length
          ? errorsData.errors.map((workflow) => (
              <tr
                key={workflow.id}
                className="group transition-colors hover:bg-muted"
              >
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-foreground">
                  #{truncateId(workflow.id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {truncateId(workflow.workflow_id)}
                </td>
                <td className="px-6 py-4 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                  {truncateId(workflow.user_id)}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] font-medium tracking-wide text-destructive">
                    {workflow.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-[13px] text-muted-foreground">
                  {formatDateTime(workflow.started_at)}
                </td>
                <td className="px-6 py-4 text-[13px] font-medium text-muted-foreground">
                  {formatDuration(workflow.elapsed_seconds)}
                </td>
              </tr>
            ))
          : null}
      </WorkflowTableSection>
    </div>
  );
}
