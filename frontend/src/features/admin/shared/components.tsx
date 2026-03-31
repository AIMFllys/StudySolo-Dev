'use client';

import type { ChangeEvent, ReactNode } from 'react';
import { motion } from 'framer-motion';

// ── Shared color tokens (Supabase-inspired dark theme) ──────
// bg-primary:    #171717  (cards, panels)
// bg-surface:    #1c1c1c  (page background — set in layout)
// bg-elevated:   #232323  (hover, elevated surfaces)
// border:        #2e2e2e  (subtle borders)
// border-bright: #3e3e3e  (interactive borders)
// text-primary:  #ededed
// text-secondary:#8f8f8f
// text-muted:    #666666
// accent:        #3ecf8e  (emerald/green)

export interface AdminSelectOption {
  value: string;
  label: string;
}

// ── PageHeader ──────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#ededed]">{title}</h1>
        {description && (
          <p className="mt-1 text-[13px] text-[#8f8f8f] leading-relaxed max-w-xl">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── KpiCard ─────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
}

export function KpiCard({ label, value, sub }: KpiCardProps) {
  return (
    <div className="rounded-md border border-[#2e2e2e] bg-[#171717] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#666]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#ededed]">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#666]">{sub}</p>}
    </div>
  );
}

// ── AdminSelect ─────────────────────────────────────────────

interface AdminSelectProps {
  value: string;
  options: AdminSelectOption[];
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
}

export function AdminSelect({ value, options, onChange, className = '' }: AdminSelectProps) {
  return (
    <label className={`relative block min-w-[160px] ${className}`}>
      <select
        value={value}
        onChange={onChange}
        className="peer w-full appearance-none rounded-md border border-[#2e2e2e] bg-[#171717] px-3 py-2 pr-9 text-[13px] font-medium text-[#ededed] outline-none transition-colors hover:border-[#3e3e3e] focus:border-[#3ecf8e] focus:ring-1 focus:ring-[#3ecf8e]/30"
      >
        {options.map((opt) => (
          <option key={`${opt.value || 'empty'}-${opt.label}`} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[16px] text-[#666] peer-focus:text-[#3ecf8e]">
        expand_more
      </span>
    </label>
  );
}

// ── TableSkeletonRows ───────────────────────────────────────

interface TableSkeletonRowsProps {
  rows: number;
  cols: number;
}

export function TableSkeletonRows({ rows, cols }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-[#2e2e2e] last:border-0">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <div className="h-3.5 w-20 animate-pulse rounded bg-[#232323]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Pagination ──────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, loading, onPageChange }: PaginationProps) {
  if (totalPages <= 1 && total == null) return null;

  return (
    <div className="flex items-center justify-between border-t border-[#2e2e2e] px-4 py-3">
      <span className="text-[12px] text-[#666]">
        第 <span className="text-[#ededed] font-medium">{page}</span> / {totalPages} 页
        {total != null ? ` · 共 ${total.toLocaleString('zh-CN')} 条` : ''}
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-[#2e2e2e] bg-[#171717] px-3 py-1.5 text-[12px] font-medium text-[#8f8f8f] transition-colors hover:border-[#3e3e3e] hover:text-[#ededed] disabled:cursor-not-allowed disabled:opacity-40"
        >
          上一页
        </button>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-[#2e2e2e] bg-[#171717] px-3 py-1.5 text-[12px] font-medium text-[#8f8f8f] transition-colors hover:border-[#3e3e3e] hover:text-[#ededed] disabled:cursor-not-allowed disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

// ── StatusBadge ─────────────────────────────────────────────

interface StatusBadgeProps {
  label: string;
  className?: string;
}

export function StatusBadge({ label, className = '' }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

// ── EmptyState ──────────────────────────────────────────────

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[#2e2e2e] px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#232323]">
        <span className="material-symbols-outlined text-[20px] text-[#666]">inbox</span>
      </div>
      <p className="text-[13px] font-medium text-[#8f8f8f]">{title}</p>
      <p className="mt-1 text-[12px] text-[#666] max-w-xs">{description}</p>
    </div>
  );
}

// ── ToastStack ──────────────────────────────────────────────

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

interface ToastStackProps {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}

const TOAST_STYLES = {
  success: 'border-emerald-800/50 bg-emerald-950/80 text-emerald-300',
  error: 'border-red-800/50 bg-red-950/80 text-red-300',
  info: 'border-blue-800/50 bg-blue-950/80 text-blue-300',
};

const TOAST_ICONS = { success: 'check_circle', error: 'error', info: 'info' };

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className={`flex items-start gap-2.5 rounded-md border p-3 shadow-lg backdrop-blur-sm min-w-[280px] ${TOAST_STYLES[t.kind] ?? TOAST_STYLES.info}`}
        >
          <span className="material-symbols-outlined mt-0.5 text-[18px] opacity-80">{TOAST_ICONS[t.kind]}</span>
          <span className="flex-1 text-[13px] font-medium leading-relaxed">{t.message}</span>
          <button onClick={() => onDismiss(t.id)} className="material-symbols-outlined rounded p-0.5 text-[16px] opacity-50 transition-opacity hover:opacity-100">close</button>
        </motion.div>
      ))}
    </div>
  );
}
