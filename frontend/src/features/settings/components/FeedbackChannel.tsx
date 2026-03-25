'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquarePlus, X, Send, Gift,
  Sparkles, Star, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { authedFetch, parseApiError } from '@/services/api-client';

const ISSUE_OPTIONS = [
  'AI 回答不够精准',
  '操作不够流畅',
  '功能缺失',
  '内容管理痛点',
  '界面不够美观',
  '其它',
];

export function FeedbackChannel() {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [issueType, setIssueType] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setRating(0);
    setIssueType('');
    setFeedback('');
  };

  const handleSubmit = async () => {
    if (!rating) {
      toast.error('请选择满意度评分');
      return;
    }
    if (feedback.trim().length < 5) {
      toast.error('反馈内容请至少输入 5 个字');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await authedFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          rating,
          issue_type: issueType,
          content: feedback.trim(),
        }),
      });

      if (!res.ok) {
        const msg = await parseApiError(res, '反馈提交失败，请稍后重试');
        toast.error(msg);
        return;
      }

      const data = await res.json();

      setIsOpen(false);
      resetForm();
      toast.success('提交成功！', {
        description: data.message || '感谢您的反馈！',
        duration: 5000,
        icon: <Sparkles className="w-4 h-4 text-primary" />,
      });
    } catch {
      toast.error('网络异常，请检查连接后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-[11px] font-medium text-primary shadow-sm outline-none transition-all hover:bg-primary/20 hover:shadow-md focus-visible:ring-2"
      >
        <MessageSquarePlus className="h-4 w-4" />
        填写诊断反馈享好礼
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <FeedbackDrawer
              rating={rating}
              setRating={setRating}
              issueType={issueType}
              setIssueType={setIssueType}
              feedback={feedback}
              setFeedback={setFeedback}
              isSubmitting={isSubmitting}
              onClose={() => setIsOpen(false)}
              onSubmit={handleSubmit}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Drawer sub-component (extracted to keep main component lean)
// ---------------------------------------------------------------------------

interface DrawerProps {
  rating: number;
  setRating: (v: number) => void;
  issueType: string;
  setIssueType: (v: string) => void;
  feedback: string;
  setFeedback: (v: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function FeedbackDrawer({
  rating, setRating,
  issueType, setIssueType,
  feedback, setFeedback,
  isSubmitting, onClose, onSubmit,
}: DrawerProps) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/10 dark:bg-black/40 transition-colors">
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} aria-label="Close" />

      <motion.div
        initial={{ opacity: 0, x: '100%' }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 220 }}
        className="node-paper-bg relative flex h-full w-[85vw] max-w-[650px] flex-col overflow-hidden bg-background shadow-[0_0_60px_rgba(0,0,0,0.1)] border-l border-border/40"
      >
        {/* Grid texture */}
        <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]">
          <svg width="100%" height="100%">
            <pattern id="scholarly-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
              <circle cx="0" cy="0" r="1.5" fill="currentColor" className="text-primary/50" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#scholarly-grid)" />
          </svg>
        </div>
        <div className="pointer-events-none absolute left-5 top-0 bottom-0 w-[1px] bg-red-500/15 z-0" />
        <div className="pointer-events-none absolute left-[24px] top-0 bottom-0 w-[1px] bg-red-500/15 z-0" />

        {/* Header */}
        <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-border/40 px-10 py-6 bg-muted/10">
          <div className="flex items-center gap-3 text-foreground">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-sm">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-foreground font-serif">产品诊断与体验问卷</h3>
              <p className="text-xs text-muted-foreground mt-1 font-medium tracking-wide">您的真实反馈是 StudySolo 进化的关键养料</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground border border-transparent hover:border-border/50">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="relative z-10 scrollbar-hide flex-1 overflow-y-auto px-10 py-8 space-y-8">
          {/* Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden shadow-sm">
            <div className="absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 opacity-10 pointer-events-none">
              <Sparkles className="h-32 w-32 text-primary" />
            </div>
            <h4 className="flex items-center gap-2 text-sm font-bold text-primary">
              <Gift className="h-4 w-4" />
              感恩反馈计划
            </h4>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground max-w-[85%] font-medium">
              提交反馈即可获得 <strong className="font-bold text-foreground">3 天</strong> 高级会员时长。若反馈了核心痛点或重大 Bug，将追加 <strong className="font-bold text-foreground">7 - 30 天</strong> 不等的额外激励！
            </p>
          </div>

          <div className="space-y-8">
            {/* Q1: Star Rating */}
            <div className="space-y-3">
              <label className="block text-[13px] font-bold text-foreground">1. 您对当前版本的总体体验满意度如何？ <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(s)} className={`flex flex-col items-center justify-center h-16 w-16 rounded-xl border-2 transition-all duration-200 ${rating === s ? 'border-primary bg-primary/10 text-primary shadow-sm scale-110 z-10' : 'border-border/50 bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:-translate-y-1'}`}>
                    <Star className={`h-6 w-6 ${rating >= s ? 'fill-current' : ''}`} />
                    <span className="text-[10px] mt-1.5 font-bold">{s} 分</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Issue Type */}
            <div className="space-y-3">
              <label className="block text-[13px] font-bold text-foreground">2. 请问您使用过程中遇到最突出的问题是？</label>
              <div className="flex flex-wrap gap-2.5">
                {ISSUE_OPTIONS.map((opt) => (
                  <button key={opt} onClick={() => setIssueType(opt === issueType ? '' : opt)} className={`rounded-lg border px-4 py-2.5 text-[12px] font-medium transition-all duration-200 ${issueType === opt ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-muted/80'}`}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Q3: Textarea */}
            <div className="space-y-3">
              <label htmlFor="feedback" className="block text-[13px] font-bold text-foreground">3. 不设限畅谈：如果您是产品经理，最想改动哪里？ <span className="text-red-500">*</span></label>
              <textarea id="feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="描述您的期望操作流程、功能痛点，或者遇到 Bug 的复现路径..." className="h-44 w-full resize-none rounded-xl border-2 border-border/50 bg-background/50 p-4 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all leading-relaxed shadow-inner" />
            </div>

            {/* Submit area */}
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-primary/10 bg-primary/[0.03] p-4 shadow-sm backdrop-blur-sm">
              <p className="text-[12px] text-muted-foreground/80 font-medium flex items-center gap-2 pl-2 tracking-wide">
                <ShieldCheck className="w-[18px] h-[18px] text-primary/60" />
                安全保证：我们非常重视您的隐私权益
              </p>
              <div className="flex items-center gap-3 pr-1">
                <button onClick={onClose} className="rounded-xl border border-border/60 bg-background/60 px-6 py-2.5 text-[13px] font-bold text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground shadow-sm">暂不提交</button>
                <button onClick={onSubmit} disabled={isSubmitting} className="flex items-center gap-2 rounded-xl bg-primary px-7 py-2.5 text-[13px] font-bold text-primary-foreground shadow-md transition-all hover:opacity-90 hover:shadow-lg active:scale-95 disabled:pointer-events-none disabled:opacity-50">
                  {isSubmitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send className="h-4 w-4" />}
                  <span>立即提交赚奖励</span>
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="flex flex-col items-center justify-center pt-8 pb-4">
            <svg width="200" height="24" viewBox="0 0 200 24" fill="none" stroke="currentColor" className="text-muted-foreground/30">
              <path d="M20 12 L85 12" strokeWidth="1" strokeLinecap="round" />
              <circle cx="78" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <path d="M100 4 L102 10 L108 12 L102 14 L100 20 L98 14 L92 12 L98 10 Z" fill="currentColor" stroke="none" className="text-primary/50" />
              <circle cx="122" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <path d="M115 12 L180 12" strokeWidth="1" strokeLinecap="round" />
            </svg>
            <p className="mt-4 text-[10px] font-serif text-muted-foreground/60 tracking-[0.2em] uppercase">Thanks for improving StudySolo</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
