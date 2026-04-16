'use client';

import {
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
  ChartShell, TimeRangeToggle, tooltipStyle, formatCny,
  colorAssistant, colorWorkflow,
} from './dashboard-chart-shell';

interface CostTrendChartProps {
  timeseries: UsageTimeseriesResponse;
  timeRange: AdminUsageRange;
  onTimeRangeChange: (value: AdminUsageRange) => void;
}

export function CostTrendChart({ timeseries, timeRange, onTimeRangeChange }: CostTrendChartProps) {
  const chartData = timeseries.points.map((point) => ({
    ts: point.ts,
    assistant_cost_cny: point.assistant_cost_cny,
    workflow_cost_cny: point.workflow_cost_cny,
  }));

  const hasData = chartData.some((d) => d.assistant_cost_cny > 0 || d.workflow_cost_cny > 0);

  return (
    <ChartShell
      title="费用趋势"
      description="人民币 (CNY) 总成本走势"
      action={<TimeRangeToggle timeRange={timeRange} onTimeRangeChange={onTimeRangeChange} />}
    >
      {hasData ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="ts" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} dy={8} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCny(value), 'Cost']} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
            <Line type="monotone" dataKey="assistant_cost_cny" stroke={colorAssistant} strokeWidth={3} dot={false} name="Assistant Cost" activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="workflow_cost_cny" stroke={colorWorkflow} strokeWidth={3} dot={false} name="Workflow Cost" activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground/60">
            <span className="material-symbols-outlined text-4xl">trending_up</span>
            <p className="text-[13px]">该时段内暂无费用记录</p>
          </div>
        </div>
      )}
    </ChartShell>
  );
}
