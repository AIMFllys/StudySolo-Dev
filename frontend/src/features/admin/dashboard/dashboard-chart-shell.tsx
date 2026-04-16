import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { AdminUsageRange } from '@/types/usage';

export const tooltipStyle = {
  backgroundColor: 'var(--secondary)',
  border: '1px solid var(--border)',
  borderRadius: '0.375rem',
  color: 'var(--foreground)',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)',
};

export const colorAssistant = '#6366f1';
export const colorWorkflow = '#14b8a6';

export const TIME_RANGE_OPTIONS: { value: AdminUsageRange; label: string }[] = [
  { value: '24h', label: '1D' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '1月' },
  { value: 'all', label: '所有' },
];

export function formatCny(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: value >= 1 ? 2 : 4,
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

export function ChartShell({
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
      className="relative overflow-hidden rounded-md border border-border bg-card p-6"
    >
      <div className="relative z-10 flex flex-col h-full">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-foreground">{title}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
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

export function TimeRangeToggle({
  timeRange,
  onTimeRangeChange,
}: { timeRange: AdminUsageRange; onTimeRangeChange: (value: AdminUsageRange) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-secondary p-1">
      {TIME_RANGE_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onTimeRangeChange(option.value)}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            option.value === timeRange
              ? 'bg-card text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
