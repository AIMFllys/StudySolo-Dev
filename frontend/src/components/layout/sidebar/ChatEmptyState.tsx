'use client';

import { motion } from 'framer-motion';
import { History } from 'lucide-react';
import { MagicWandLoader, StudySoloIcon } from './MagicWandLoader';

export function SkeletonLoader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-2.5 py-1 pl-0.5"
    >
      <MagicWandLoader />
      <span className="text-[10px] font-medium tracking-wider text-muted-foreground/60 font-sans">
        AI 正在思考…
      </span>
    </motion.div>
  );
}

export function ChatEmptyState({ lastPrompt, scrollRef }: { lastPrompt: string; scrollRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative mb-5"
        >
          <div className="node-paper-bg flex h-12 w-12 items-center justify-center rounded-xl border-[1.5px] border-border/50 shadow-sm">
            <StudySoloIcon className="h-5 w-5 text-primary stroke-[1.5]" />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h3 className="text-[13px] font-bold text-foreground/90 font-serif">准备就绪</h3>
          <p className="mt-1.5 max-w-[200px] text-[11px] leading-relaxed text-muted-foreground/80 font-serif">
            描述你的学习目标，我将为你构建工作流。
            <br />也可以对话讨论或修改已有节点。
          </p>
        </motion.div>
        {lastPrompt ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex items-center gap-1.5 rounded-lg border-[1.5px] border-border/50 node-paper-bg px-2.5 py-1.5 shadow-sm"
          >
            <History className="h-3 w-3 text-muted-foreground stroke-[1.5]" />
            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[180px]">
              {lastPrompt.slice(0, 40)}{lastPrompt.length > 40 ? '...' : ''}
            </span>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}
