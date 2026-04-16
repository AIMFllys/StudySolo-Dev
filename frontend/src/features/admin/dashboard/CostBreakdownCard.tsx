'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CostSplitResponse, ModelBreakdownResponse } from '@/types/usage';
import { ChartShell, tooltipStyle, formatCny, colorAssistant, colorWorkflow } from './dashboard-chart-shell';

interface CostBreakdownCardProps {
  costSplit: CostSplitResponse;
  modelBreakdown: ModelBreakdownResponse;
}

export function CostBreakdownCard({ costSplit, modelBreakdown }: CostBreakdownCardProps) {
  const pieData = costSplit.items.map((item) => ({
    name: item.source_type === 'assistant' ? 'Assistant' : 'Workflow',
    value: item.total_cost_cny,
  }));

  const topModels = modelBreakdown.items.slice(0, 8);

  return (
    <ChartShell title="成本拆分与模型排行" description="账单来源拆分与具体模型成本一览">
      <div className="flex h-full gap-8">
        <div className="flex shrink-0 flex-col items-center justify-center gap-6 w-[260px]">
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [formatCny(value), 'Cost']} />
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} innerRadius={70} stroke="none" paddingAngle={3}>
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={index === 0 ? colorAssistant : colorWorkflow} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5 w-full px-2">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: index === 0 ? colorAssistant : colorWorkflow }} />
                  {entry.name}
                </span>
                <span className="font-mono text-[12px] font-medium text-foreground">{formatCny(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="w-px shrink-0 self-stretch bg-border" />

        <div className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-card">
          <div className="overflow-auto h-full">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-card">
                  <th className="px-5 py-3.5 font-medium text-foreground">SKU / Model</th>
                  <th className="px-5 py-3.5 font-medium text-foreground tabular-nums">Calls</th>
                  <th className="px-5 py-3.5 font-medium text-foreground tabular-nums">Tokens</th>
                  <th className="px-5 py-3.5 font-medium text-foreground tabular-nums">Cost (CNY)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topModels.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-muted-foreground">暂无模型账本数据</td>
                  </tr>
                ) : (
                  topModels.map((item) => (
                    <tr key={item.sku_id ?? `${item.provider}-${item.model}`} className="transition-colors hover:bg-muted">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-foreground">{item.provider}/{item.model}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground/60">{item.vendor} · {item.billing_channel}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-muted-foreground">{item.provider_call_count.toLocaleString('zh-CN')}</td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-muted-foreground">{item.total_tokens.toLocaleString('zh-CN')}</td>
                      <td className="px-5 py-3.5 font-mono text-[13px] font-medium text-foreground">{formatCny(item.total_cost_cny)}</td>
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
