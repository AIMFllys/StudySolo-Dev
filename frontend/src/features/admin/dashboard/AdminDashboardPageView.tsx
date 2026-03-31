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
    <div className="mx-auto min-h-full max-w-[1600px] space-y-5 px-6 py-6">
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
            className="flex items-center gap-2 rounded-lg bg-[#3ecf8e] px-5 py-2.5 text-[13px] font-medium text-[#171717] transition-all hover:bg-[#2db87a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e]"
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
        className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_360px]"
      >
        <div className="space-y-5">
          {error ? (
            <div className="rounded-md border border-red-800/40 bg-red-950/30 p-4 text-[13px] text-red-400 flex items-start gap-3">
              <span className="material-symbols-outlined text-[20px] text-red-400">error</span>
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

        <aside className="overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717] h-fit">
          <div className="border-b border-[#2e2e2e] bg-[#171717] px-6 py-5">
            <h3 className="text-lg font-medium text-[#ededed]">实时观察面板</h3>
            <p className="mt-1 text-[12px] text-[#8f8f8f]">LIVE USAGE STREAM</p>
          </div>
          
          <div className="p-6 space-y-5">
            <section className="rounded-md border border-[#2e2e2e] bg-[#232323] p-5">
              <p className="text-[12px] font-medium uppercase tracking-widest text-[#666]">当前时间范围</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-[#ededed]">{timeRange}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-[#8f8f8f]">
                概览与最近调用每 15 秒刷新；时序图与模型排行每 60 秒刷新。
              </p>
            </section>

            <section className="rounded-md border border-[#2e2e2e] bg-[#232323] p-5">
              <p className="text-[12px] font-medium uppercase tracking-widest text-[#666]">近 5 分钟热力数据</p>
              <div className="mt-4 space-y-3 text-[13px] text-[#8f8f8f]">
                <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-2">
                  <span>逻辑请求</span>
                  <span className="font-medium text-[#ededed]">{live?.summary.logical_request_count?.toLocaleString('zh-CN') ?? '0'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-2">
                  <span>真实 API 调用</span>
                  <span className="font-medium text-[#ededed]">{live?.summary.provider_call_count?.toLocaleString('zh-CN') ?? '0'}</span>
                </div>
                <div className="flex items-center justify-between border-b border-[#2e2e2e] pb-2">
                  <span>流通 Tokens</span>
                  <span className="font-medium text-[#ededed]">{live?.summary.total_tokens?.toLocaleString('zh-CN') ?? '0'}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span>实时消耗费用</span>
                  <span className="font-medium text-[#3ecf8e]">{formatCny(live?.summary.total_cost_cny ?? 0)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-[#2e2e2e] bg-[#232323] p-5">
              <p className="text-[12px] font-medium uppercase tracking-widest text-[#666]">两账本实时总计</p>
              <div className="mt-4 space-y-4 text-[13px] text-[#8f8f8f]">
                <div className="rounded-lg bg-[#171717] p-3 border border-[#2e2e2e]">
                  <p className="text-[10px] font-medium tracking-wider text-[#666] uppercase mb-2">ASSISTANT</p>
                  <div className="flex items-center justify-between">
                    <span>总计调用</span>
                    <span className="font-medium text-[#ededed]">{overview?.assistant.provider_call_count?.toLocaleString('zh-CN') ?? '0'} 次</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>总计费用</span>
                    <span className="font-medium text-[#ededed]">{formatCny(overview?.assistant.total_cost_cny ?? 0)}</span>
                  </div>
                </div>
                <div className="rounded-lg bg-[#171717] p-3 border border-[#2e2e2e]">
                  <p className="text-[10px] font-medium tracking-wider text-[#666] uppercase mb-2">WORKFLOW</p>
                  <div className="flex items-center justify-between">
                    <span>总计调用</span>
                    <span className="font-medium text-[#ededed]">{overview?.workflow.provider_call_count?.toLocaleString('zh-CN') ?? '0'} 次</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span>总计费用</span>
                    <span className="font-medium text-[#ededed]">{formatCny(overview?.workflow.total_cost_cny ?? 0)}</span>
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
