'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  getAdminAiCostSplit,
  getAdminAiLive,
  getAdminAiModelBreakdown,
  getAdminAiOverview,
  getAdminAiRecentCalls,
  getAdminAiTimeseries,
} from '@/services/admin.service';
import type {
  AdminUsageRange,
  CostSplitResponse,
  ModelBreakdownResponse,
  RecentCallsResponse,
  UsageLiveResponse,
  UsageOverviewResponse,
  UsageTimeseriesResponse,
} from '@/types/usage';
import { EmptyState, PageHeader } from '@/features/admin/shared';
import { DashboardActivityTable } from './DashboardActivityTable';
import { CostBreakdownCard, CostTrendChart, DashboardChartsSection } from './DashboardChartsSection';
import { DashboardKpiSection } from './DashboardKpiSection';

function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

export function AdminDashboardPageView() {
  const [timeRange, setTimeRange] = useState<AdminUsageRange>('7d');
  const [overview, setOverview] = useState<UsageOverviewResponse | null>(null);
  const [live, setLive] = useState<UsageLiveResponse | null>(null);
  const [timeseries, setTimeseries] = useState<UsageTimeseriesResponse | null>(null);
  const [modelBreakdown, setModelBreakdown] = useState<ModelBreakdownResponse | null>(null);
  const [costSplit, setCostSplit] = useState<CostSplitResponse | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(!document.hidden);
    onVisibilityChange();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFastData() {
      try {
        const [overviewResult, liveResult, recentCallsResult] = await Promise.all([
          getAdminAiOverview(timeRange),
          getAdminAiLive('5m'),
          getAdminAiRecentCalls(20),
        ]);
        if (cancelled) {
          return;
        }
        setOverview(overviewResult);
        setLive(liveResult);
        setRecentCalls(recentCallsResult);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载后台 AI 仪表盘失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFastData();
    if (!isVisible) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void loadFastData();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isVisible, timeRange]);

  useEffect(() => {
    let cancelled = false;

    async function loadSlowData() {
      try {
        const [timeseriesResult, modelBreakdownResult, costSplitResult] = await Promise.all([
          getAdminAiTimeseries(timeRange, 'all'),
          getAdminAiModelBreakdown(timeRange, 'all'),
          getAdminAiCostSplit(timeRange),
        ]);
        if (cancelled) {
          return;
        }
        setTimeseries(timeseriesResult);
        setModelBreakdown(modelBreakdownResult);
        setCostSplit(costSplitResult);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载后台 AI 图表失败');
        }
      }
    }

    void loadSlowData();
    if (!isVisible) {
      return () => {
        cancelled = true;
      };
    }

    const intervalId = window.setInterval(() => {
      void loadSlowData();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isVisible, timeRange]);

  return (
    <div className="mx-auto min-h-full max-w-[1600px] space-y-8 px-8 py-8">
      <PageHeader
        title="AI 使用量与计费看板"
        description="平台全局 AI 请求、真实 API 调用、Token、CNY 成本与最近调用明细汇聚于此"
        action={(
          <button
            onClick={() => {
              setLoading(true);
              void Promise.all([
                getAdminAiOverview(timeRange).then(setOverview),
                getAdminAiLive('5m').then(setLive),
                getAdminAiRecentCalls(20).then(setRecentCalls),
                getAdminAiTimeseries(timeRange, 'all').then(setTimeseries),
                getAdminAiModelBreakdown(timeRange, 'all').then(setModelBreakdown),
                getAdminAiCostSplit(timeRange).then(setCostSplit),
              ]).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : '刷新后台 AI 仪表盘失败');
              }).finally(() => {
                setLoading(false);
              });
            }}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm ring-1 ring-inset ring-indigo-500 transition-all hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            刷新数据
          </button>
        )}
      />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]"
      >
        <div className="space-y-6">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-red-500">error</span>
              <span className="mt-0.5">{error}</span>
            </div>
          ) : null}

          {loading && !overview && !timeseries ? (
            <EmptyState
              title="正在加载 AI 数据洞察"
              description="正在汇总 Assistant 与 Workflow 两本账的全局数据，请稍候。"
            />
          ) : null}

          {overview ? <DashboardKpiSection overview={overview} live={live} /> : null}
          {timeseries ? (
            <DashboardChartsSection
              timeseries={timeseries}
              timeRange={timeRange}
              onTimeRangeChange={setTimeRange}
            />
          ) : null}
        </div>

        <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5 h-fit">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5">
            <h3 className="text-lg font-semibold text-slate-900">实时观察面板</h3>
            <p className="mt-1 text-xs text-slate-500">LIVE USAGE STREAM</p>
          </div>
          
          <div className="p-6 space-y-6">
            <section className="rounded-xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">当前时间范围</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{timeRange}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                概览与最近调用每 15 秒刷新；时序图与模型排行每 60 秒刷新。
              </p>
            </section>

            <section className="rounded-xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">近 5 分钟热力数据</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span>逻辑请求</span>
                  <span className="font-semibold text-slate-900">{live?.summary.logical_request_count?.toLocaleString('zh-CN') ?? '0'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span>真实 API 调用</span>
                  <span className="font-semibold text-slate-900">{live?.summary.provider_call_count?.toLocaleString('zh-CN') ?? '0'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span>流通 Tokens</span>
                  <span className="font-semibold text-slate-900">{live?.summary.total_tokens?.toLocaleString('zh-CN') ?? '0'}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>实时消耗费用</span>
                  <span className="font-bold text-indigo-600">{formatCny(live?.summary.total_cost_cny ?? 0)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-slate-50 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">两账本实时总计</p>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200/50">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">ASSISTANT</p>
                  <div className="flex items-center justify-between">
                    <span>总计调用</span>
                    <span className="font-semibold text-slate-900">{overview?.assistant.provider_call_count?.toLocaleString('zh-CN') ?? '0'} 次</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>总计费用</span>
                    <span className="font-semibold text-slate-900">{formatCny(overview?.assistant.total_cost_cny ?? 0)}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200/50">
                  <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase mb-2">WORKFLOW</p>
                  <div className="flex items-center justify-between">
                    <span>总计调用</span>
                    <span className="font-semibold text-slate-900">{overview?.workflow.provider_call_count?.toLocaleString('zh-CN') ?? '0'} 次</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>总计费用</span>
                    <span className="font-semibold text-slate-900">{formatCny(overview?.workflow.total_cost_cny ?? 0)}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </motion.section>

      {/* Full-width cards — outside the sidebar grid */}
      {timeseries ? (
        <CostTrendChart
          timeseries={timeseries}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      ) : null}

      {costSplit && modelBreakdown ? (
        <CostBreakdownCard
          costSplit={costSplit}
          modelBreakdown={modelBreakdown}
        />
      ) : null}

      <DashboardActivityTable recentCalls={recentCalls} loading={loading} />
    </div>
  );
}
