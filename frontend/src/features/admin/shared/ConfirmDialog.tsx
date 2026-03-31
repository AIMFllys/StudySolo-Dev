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

const VARIANTS = {
  danger: { icon: 'warning', iconColor: 'text-red-400', btn: 'bg-red-600 hover:bg-red-500' },
  warning: { icon: 'error', iconColor: 'text-amber-400', btn: 'bg-amber-600 hover:bg-amber-500' },
  default: { icon: 'help', iconColor: 'text-[#3ecf8e]', btn: 'bg-[#3ecf8e] hover:bg-[#2db87a] text-[#171717]' },
};

export function ConfirmDialog({
  open, title, description, confirmLabel = '确认', cancelLabel = '取消',
  variant = 'default', loading = false, onConfirm, onCancel, children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const v = VARIANTS[variant];

  useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-0 bg-black/60" onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="dialog" aria-modal="true"
            className="relative w-full max-w-md rounded-lg border border-[#2e2e2e] bg-[#1c1c1c] p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined mt-0.5 text-[20px] ${v.iconColor}`}>{v.icon}</span>
              <div className="flex-1 space-y-1.5">
                <h3 className="text-[14px] font-semibold text-[#ededed]">{title}</h3>
                {description && <p className="text-[13px] text-[#8f8f8f] leading-relaxed">{description}</p>}
                {children && <div className="mt-2">{children}</div>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                ref={cancelRef} onClick={onCancel} disabled={loading}
                className="rounded-md border border-[#2e2e2e] bg-[#232323] px-3.5 py-1.5 text-[13px] font-medium text-[#8f8f8f] transition-colors hover:border-[#3e3e3e] hover:text-[#ededed] disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm} disabled={loading}
                className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors disabled:opacity-50 ${v.btn}`}
              >
                {loading && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
