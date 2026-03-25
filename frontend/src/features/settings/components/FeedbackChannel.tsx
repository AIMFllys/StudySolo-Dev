'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, X, Send, Gift, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';

export function FeedbackChannel() {
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [issueType, setIssueType] = useState<string>('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!rating) {
      toast.error('请选择满意度评分');
      return;
    }
    if (!feedback.trim()) {
      toast.error('请输入反馈内容');
      return;
    }
    
    setIsSubmitting(true);
    
    // 模拟提交
    setTimeout(() => {
      setIsSubmitting(false);
      setIsOpen(false);
      setRating(0);
      setIssueType('');
      setFeedback('');
      toast.success('提交成功！', {
        description: '感谢您的反馈，我们已赠送您 3 天高级会员体验时长！',
        duration: 4000,
        icon: <Sparkles className="w-4 h-4 text-primary" />,
      });
    }, 1000);
  };

  const ISSUE_OPTIONS = ['AI 回答不够精准', '操作不够流畅', '功能缺失', '内容管理痛点', '界面不够美观', '其它'];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5 text-[11px] font-medium text-primary shadow-sm outline-none transition-all hover:bg-primary/20 hover:shadow-md focus-visible:ring-2"
      >
        <MessageSquarePlus className="h-4 w-4" />
        填写诊断反馈享好礼
      </button>

      {/* Render modal in portal to avoid overflow clipping */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/10 dark:bg-black/40 transition-colors">
              {/* Overlay clickable area bounds */}
              <div 
                className="absolute inset-0 cursor-pointer" 
                onClick={() => setIsOpen(false)} 
                aria-label="Close modal background"
              />
              
              {/* The Drawer Panel */}
              <motion.div
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                className="node-paper-bg relative flex h-full w-[85vw] max-w-[650px] flex-col overflow-hidden bg-background shadow-[0_0_60px_rgba(0,0,0,0.1)] border-l border-border/40"
              >
                {/* Paper Texture & Scholarly Grid */}
                <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]">
                  <svg width="100%" height="100%">
                    <pattern id="scholarly-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
                      <circle cx="0" cy="0" r="1.5" fill="currentColor" className="text-primary/50" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#scholarly-grid)" />
                  </svg>
                </div>
                
                {/* Decorative Red Notebook Margin Line */}
                <div className="pointer-events-none absolute left-8 top-0 bottom-0 w-[1.5px] bg-red-500/10 z-0" />

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
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground border border-transparent hover:border-border/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="relative z-10 scrollbar-hide flex-1 overflow-y-auto px-10 py-8 space-y-8">
                  {/* Notice Banner */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 relative overflow-hidden shadow-sm">
                    <div className="absolute right-0 top-0 -translate-y-1/4 translate-x-1/4 opacity-10 pointer-events-none">
                      <Sparkles className="h-32 w-32 text-primary" />
                    </div>
                    <h4 className="flex items-center gap-2 text-sm font-bold text-primary">
                      <Gift className="h-4 w-4" />
                      感恩反馈计划
                    </h4>
                    <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground max-w-[85%] font-medium">
                      参与反馈即可获得 <strong className="font-bold text-foreground">3天</strong> 基础时长。若您反馈了核心痛点、重大 Bug，或提供了被采纳的建设性意见，将追加 <strong className="font-bold text-foreground">7 - 30 天</strong> 不等的高级会员激励！
                    </p>
                  </div>

                  {/* Form specific sections */}
                  <div className="space-y-8">
                    {/* Rating */}
                    <div className="space-y-3">
                      <label className="block text-[13px] font-bold text-foreground">
                        1. 您对当前版本的总体体验满意度如何？ <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            onClick={() => setRating(score)}
                            className={`flex flex-col items-center justify-center h-16 w-16 rounded-xl border-2 transition-all duration-200 ${
                              rating === score 
                                ? 'border-primary bg-primary/10 text-primary shadow-sm scale-110 z-10' 
                                : 'border-border/50 bg-background/50 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 hover:-translate-y-1'
                            }`}
                          >
                            <Star className={`h-6 w-6 ${rating >= score ? 'fill-current' : ''}`} />
                            <span className="text-[10px] mt-1.5 font-bold">{score} 分</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Issue Type */}
                    <div className="space-y-3">
                      <label className="block text-[13px] font-bold text-foreground">
                        2. 请问您使用过程中遇到最突出的问题是？
                      </label>
                      <div className="flex flex-wrap gap-2.5">
                        {ISSUE_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setIssueType(opt === issueType ? '' : opt)}
                            className={`rounded-lg border px-4 py-2.5 text-[12px] font-medium transition-all duration-200 ${
                              issueType === opt
                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                : 'border-border/60 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-muted/80'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Textarea */}
                    <div className="space-y-3">
                      <label htmlFor="feedback" className="block text-[13px] font-bold text-foreground">
                        3. 不设限畅谈：如果您是产品经理，最想改动哪里？ <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="feedback"
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="描述您的期望操作流程、功能痛点，或者遇到 Bug 的复现路径...我们每天都会认真阅读每一条反馈留言。"
                        className="h-44 w-full resize-none rounded-xl border-2 border-border/50 bg-background/50 p-4 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-background focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all leading-relaxed shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Decorative Bottom Sketch */}
                  <div className="flex flex-col items-center justify-center pt-8 pb-4">
                    <svg width="220" height="70" viewBox="0 0 220 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-70">
                      {/* Flowing underline scribble */}
                      <path d="M10,50 Q60,30 110,55 T210,40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary/30" />
                      {/* Dotted path indicating paper plane trajectory */}
                      <path d="M80,55 Q120,45 160,35" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" className="text-primary/50" />
                      {/* Paper Plane Drawing */}
                      <path d="M160,35 L190,12 L205,32 L160,35 Z" fill="currentColor" className="text-primary/10" />
                      <path d="M160,35 L190,12 L205,32 Z M160,35 L182,23 L190,12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className="text-primary/60" />
                      {/* Cute hand-drawn stars around */}
                      <path d="M40,20 L44,28 L52,24 L46,32 L50,40 L42,34 L34,38 L38,30 L30,24 L38,26 Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" className="text-accent/60" />
                      <circle cx="130" cy="20" r="2" fill="currentColor" className="text-accent/40" />
                      <circle cx="180" cy="50" r="1.5" fill="currentColor" className="text-primary/40" />
                      <circle cx="150" cy="10" r="1" fill="currentColor" className="text-primary/30" />
                    </svg>
                    <p className="mt-3 text-[10px] font-serif text-muted-foreground/50 tracking-[0.2em] uppercase">
                      Thanks for improving StudySolo
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="relative z-10 shrink-0 border-t border-border/40 bg-background/50 backdrop-blur-md p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      安全保证：我们非常重视您的隐私权益
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setIsOpen(false)}
                        className="rounded-lg border border-border/50 bg-background/80 px-5 py-2.5 text-[13px] font-bold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                      >
                        暂不提交
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 rounded-lg bg-primary px-7 py-2.5 text-[13px] font-bold text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        <span>立即提交赚奖励</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
