'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminUsageRange, UsageTimeseriesResponse } from '@/types/usage';
import {
  ChartShell, TimeRangeToggle, tooltipStyle,
  colorAssistant, colorWorkflow,
} from './dashboard-chart-shell';

export { CostTrendChart } from './CostTrendChart';
export { CostBreakdownCard } from './CostBreakdownCard';

interface DashboardChartsSectionProps {
  timeseries: UsageTimeseriesResponse;
  timeRange: AdminUsageRange;
  onTimeRangeChange: (value: AdminUsageRange) => void;
}

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
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
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
