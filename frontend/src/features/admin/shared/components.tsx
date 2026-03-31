'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';

const FADE_UP = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.35, ease: 'easeOut' as const },
};

export interface AdminSelectOption {
  value: string;
  label: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <motion.div
      {...FADE_UP}
      className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </motion.div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
}

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <motion.section
      {...FADE_UP}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-900/5 transition-all hover:shadow-md hover:ring-slate-900/10"
    >
      <div className="relative z-10 flex flex-col h-full justify-between">
        <p className="mb-4 text-sm font-medium tracking-wide text-slate-500">
          {label}
        </p>
        <div>
          <p className="text-3xl font-bold text-slate-900 md:text-4xl tracking-tight">{value}</p>
          {sub ? (
            <p className="mt-2 text-xs font-medium text-slate-400">{sub}</p>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

interface AdminSelectProps {
  value: string;
  options: AdminSelectOption[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
}

export function AdminSelect({
  value,
  options,
  onChange,
  className = '',
}: AdminSelectProps) {
  return (
    <label className={`relative block min-w-[180px] ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="peer w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm font-medium text-slate-700 shadow-sm outline-none ring-1 ring-transparent transition-all hover:border-slate-300 hover:bg-slate-50 focus:border-indigo-500 focus:ring-indigo-500 focus:ring-offset-1"
      >
        {options.map((option) => (
          <option key={`${option.value || 'empty'}-${option.label}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400 transition-transform peer-focus:-translate-y-[55%] peer-focus:text-indigo-500">
        expand_more
      </span>
    </label>
  );
}

interface TableSkeletonRowsProps {
  rows: number;
  cols: number;
}

export function TableSkeletonRows({ rows, cols }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <td key={colIndex} className="px-5 py-4">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1 && total == null) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-4 rounded-b-2xl">
      <span className="text-xs font-medium text-slate-500">
        第 <span className="text-slate-900 font-semibold">{page}</span> / {totalPages} 页
        {total != null ? ` · 共 ${total.toLocaleString('zh-CN')} 条记录` : ''}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一页
        </button>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  label: string;
  className?: string;
}

export function StatusBadge({ label, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <motion.div
      {...FADE_UP}
      className="flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-16 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 shadow-sm ring-1 ring-indigo-500/10">
        <span className="material-symbols-outlined text-indigo-500">inbox</span>
      </div>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">{description}</p>
    </motion.div>
  );
}

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) {
    return null;
  }

  const colorMap = {
    success: 'border-emerald-200 bg-white text-emerald-800 shadow-emerald-500/5 ring-emerald-500/20',
    error: 'border-red-200 bg-white text-red-800 shadow-red-500/5 ring-red-500/20',
    info: 'border-blue-200 bg-white text-blue-800 shadow-blue-500/5 ring-blue-500/20',
  };

  const iconMap = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg ring-1 ring-inset ${colorMap[toast.kind] ?? colorMap.info} min-w-[300px]`}
        >
          <span className="material-symbols-outlined mt-0.5 text-[20px] opacity-80">
            {iconMap[toast.kind]}
          </span>
          <span className="flex-1 text-sm font-medium leading-relaxed">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="material-symbols-outlined -mr-1 -mt-1 rounded-lg p-1 text-[18px] opacity-50 transition-all hover:bg-black/5 hover:opacity-100"
          >
            close
          </button>
        </motion.div>
      ))}
    </div>
  );
}

