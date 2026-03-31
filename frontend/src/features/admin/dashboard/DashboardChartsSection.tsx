'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AdminUsageRange,
  CostSplitResponse,
  ModelBreakdownResponse,
  UsageTimeseriesResponse,
} from '@/types/usage';

interface DashboardChartsSectionProps {
  timeseries: UsageTimeseriesResponse;
  timeRange: AdminUsageRange;
  onTimeRangeChange: (value: AdminUsageRange) => void;
}

interface CostTrendChartProps {
  timeseries: UsageTimeseriesResponse;
  timeRange: AdminUsageRange;
  onTimeRangeChange: (value: AdminUsageRange) => void;
}

interface CostBreakdownCardProps {
  costSplit: CostSplitResponse;
  modelBreakdown: ModelBreakdownResponse;
}

const TIME_RANGE_OPTIONS: { value: AdminUsageRange; label: string }[] = [
  { value: '24h', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '1月' },
  { value: 'all', label: '所有' },
];

const tooltipStyle = {
  backgroundColor: '#232323',
  border: '1px solid #2e2e2e',
  borderRadius: '0.375rem',
  color: '#ededed',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
};

function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

function ChartShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717] p-6"
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-[#ededed]">{title}</h2>
            <p className="mt-1 text-[13px] text-[#8f8f8f]">{description}</p>
          </div>
          {action}
        </div>
        <div className="w-full h-[320px] min-h-[320px]">
          {children}
        </div>
      </div>
    </motion.section>
  );
}

function TimeRangeToggle({
  timeRange,
  onTimeRangeChange,
}: { timeRange: AdminUsageRange; onTimeRangeChange: (value: AdminUsageRange) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-[#232323] p-1">
      {TIME_RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onTimeRangeChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            option.value === timeRange
              ? 'bg-[#171717] text-[#ededed]'
              : 'text-[#8f8f8f] hover:text-[#ededed]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Colors
const colorAssistant = '#6366f1';
const colorWorkflow = '#14b8a6';

/**
 * Top two charts: Call Count + Token Trend (stays inside the sidebar grid).
 */
export function DashboardChartsSection({
  timeseries,
  timeRange,
  onTimeRangeChange,
}: DashboardChartsSectionProps) {
  const chartData = timeseries.points.map((point) => ({
    ts: point.ts,
    assistant_calls: point.assistant_calls,
    workflow_calls: point.workflow_calls,
    assistant_tokens: point.assistant_tokens,
    workflow_tokens: point.workflow_tokens,
  }));

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartShell
        title="调用次数趋势"
        description="Assistant 与 Workflow 的真实 Provider 调用次数"
        action={<TimeRangeToggle timeRange={timeRange} onTimeRangeChange={onTimeRangeChange} />}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" stroke="#666" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Bar dataKey="assistant_calls" fill={colorAssistant} name="Assistant" radius={[4, 4, 0, 0]} />
            <Bar dataKey="workflow_calls" fill={colorWorkflow} name="Workflow" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="Token 趋势" description="成功调用的 Token 消耗分布">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" stroke="#666" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Line type="monotone" dataKey="assistant_tokens" stroke={colorAssistant} strokeWidth={3} dot={false} name="Assistant Tokens" activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="workflow_tokens" stroke={colorWorkflow} strokeWidth={3} dot={false} name="Workflow Tokens" activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}

/**
 * Full-width cost trend chart — rendered outside the sidebar grid.
 */
export function CostTrendChart({
  timeseries,
  timeRange,
  onTimeRangeChange,
}: CostTrendChartProps) {
  const chartData = timeseries.points.map((point) => ({
    ts: point.ts,
    assistant_cost_cny: point.assistant_cost_cny,
    workflow_cost_cny: point.workflow_cost_cny,
  }));

  const hasData = chartData.some(
    (d) => d.assistant_cost_cny > 0 || d.workflow_cost_cny > 0,
  );

  return (
    <ChartShell
      title="费用趋势"
      description="人民币 (CNY) 总成本走势"
      action={<TimeRangeToggle timeRange={timeRange} onTimeRangeChange={onTimeRangeChange} />}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="#2e2e2e" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" stroke="#666" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [formatCny(value), 'Cost']}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Line type="monotone" dataKey="assistant_cost_cny" stroke={colorAssistant} strokeWidth={3} dot={false} name="Assistant Cost" activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="workflow_cost_cny" stroke={colorWorkflow} strokeWidth={3} dot={false} name="Workflow Cost" activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-[#666]">
            <span className="material-symbols-outlined text-4xl">trending_up</span>
            <p className="text-[13px]">该时段内暂无费用记录</p>
          </div>
        </div>
      )}
    </ChartShell>
  );
}

/**
 * Full-width cost breakdown + model ranking — rendered outside the sidebar grid.
 */
export function CostBreakdownCard({
  costSplit,
  modelBreakdown,
}: CostBreakdownCardProps) {
  const pieData = costSplit.items.map((item) => ({
    name: item.source_type === 'assistant' ? 'Assistant' : 'Workflow',
    value: item.total_cost_cny,
  }));

  const topModels = modelBreakdown.items.slice(0, 8);

  return (
    <ChartShell title="成本拆分与模型排行" description="账单来源拆分与具体模型成本一览">
      <div className="flex h-full gap-8">
        {/* Left: donut chart + legend */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-6 w-[260px]">
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [formatCny(value), 'Cost']}
                />
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={70} stroke="none" paddingAngle={3}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={index === 0 ? colorAssistant : colorWorkflow} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="space-y-2.5 w-full px-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-[#8f8f8f]">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: index === 0 ? colorAssistant : colorWorkflow }}
                  />
                  {entry.name}
                </span>
                <span className="font-mono text-[12px] font-medium text-[#ededed]">{formatCny(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px shrink-0 self-stretch bg-[#2e2e2e]" />

        {/* Right: model ranking table fills remaining space */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-[#2e2e2e] bg-[#171717]">
          <div className="overflow-auto h-full">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#2e2e2e] bg-[#171717]">
                  <th className="px-5 py-3.5 font-medium text-[#ededed]">SKU / Model</th>
                  <th className="px-5 py-3.5 font-medium text-[#ededed] tabular-nums">Calls</th>
                  <th className="px-5 py-3.5 font-medium text-[#ededed] tabular-nums">Tokens</th>
                  <th className="px-5 py-3.5 font-medium text-[#ededed] tabular-nums">Cost (CNY)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2e2e2e]">
                {topModels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-[#8f8f8f]">
                      暂无模型账本数据
                    </td>
                  </tr>
                ) : (
                  topModels.map((item) => (
                    <tr
                      key={item.sku_id ?? `${item.provider}-${item.model}`}
                      className="transition-colors hover:bg-[#1f1f1f]"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#ededed]">{item.provider}/{item.model}</div>
                        <div className="mt-0.5 text-[12px] text-[#666]">{item.vendor} · {item.billing_channel}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-[#8f8f8f]">
                        {item.provider_call_count.toLocaleString('zh-CN')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-[#8f8f8f]">
                        {item.total_tokens.toLocaleString('zh-CN')}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] font-medium text-[#ededed]">
                        {formatCny(item.total_cost_cny)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ChartShell>
  );
}
