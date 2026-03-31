'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

const VARIANT_STYLES = {
  danger: {
    icon: 'warning',
    iconBg: 'bg-red-50 ring-red-500/10',
    iconColor: 'text-red-500',
    button: 'bg-red-600 hover:bg-red-500 focus-visible:outline-red-600',
  },
  warning: {
    icon: 'error',
    iconBg: 'bg-amber-50 ring-amber-500/10',
    iconColor: 'text-amber-500',
    button: 'bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-600',
  },
  default: {
    icon: 'help',
    iconBg: 'bg-indigo-50 ring-indigo-500/10',
    iconColor: 'text-indigo-500',
    button: 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600',
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const style = VARIANT_STYLES[variant];

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/30"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ring-1 ring-slate-900/5"
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.iconBg} ring-1`}>
                <span className={`material-symbols-outlined text-[20px] ${style.iconColor}`}>{style.icon}</span>
              </div>
              <div className="flex-1 space-y-2">
                <h3 id="confirm-dialog-title" className="text-base font-bold text-slate-900">{title}</h3>
                {description && <p className="text-sm text-slate-500 leading-relaxed">{description}</p>}
                {children && <div className="mt-3">{children}</div>}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={loading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${style.button}`}
              >
                {loading && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
