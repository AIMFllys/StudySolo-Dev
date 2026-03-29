'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { PlanCard } from './PlanCard';
import { ThinkingCard } from './ThinkingCard';
import { MagicWandLoader, StudySoloIcon } from './MagicWandLoader';
import { markdownComponents } from './chat-markdown-components';
import { parseThinking } from '@/features/workflow/utils/parse-thinking';

interface HistoryEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 mt-2 pb-0.5">
      <span className="flex gap-[3px]">
        <span className="h-1 w-1 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
        <span className="h-1 w-1 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
        <span className="h-1 w-1 rounded-full bg-primary/30 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">Generating...</span>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="flex gap-[3px]">
        <span className="h-1 w-1 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
        <span className="h-1 w-1 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
        <span className="h-1 w-1 rounded-full bg-primary/30 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">Thinking...</span>
    </div>
  );
}

export const AIMessage = memo(function AIMessage({
  entry, isStreaming, onModeSwitch,
}: {
  entry: HistoryEntry; isStreaming: boolean; onModeSwitch?: (mode: string) => void;
}) {
  const { thinking, answer, hasThinking } = parseThinking(entry.content);

  if (answer.includes('<plan>')) return <PlanCard rawContent={answer} />;

  const cleanContent = answer.replace(/\[SUGGEST_MODE:(\w+)\]/g, '');
  const suggestMatch = answer.match(/\[SUGGEST_MODE:(\w+)\]/);
  const isThinkingPhase = isStreaming && hasThinking && !cleanContent.trim();
  const isGeneratingPhase = isStreaming && cleanContent.trim().length > 0;
  const isWaitingFirstToken = isStreaming && !hasThinking && !cleanContent.trim();

  return (
    <div className="ai-msg-root">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
          <StudySoloIcon className="h-3 w-3 text-primary/80" />
        </div>
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground/50 font-sans">StudySolo AI</span>
      </div>

      <div className="chat-markdown-body pl-0.5">
        {isWaitingFirstToken ? (
          <div className="flex items-center gap-2.5 py-1">
            <MagicWandLoader />
            <span className="text-[10px] font-medium tracking-wider text-muted-foreground/50 font-sans">正在思考…</span>
          </div>
        ) : (
          <>
            {hasThinking && <ThinkingCard thinking={thinking} isStreaming={isThinkingPhase} />}
            {cleanContent.trim() ? (
              <div className="prose-chat">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                  {cleanContent}
                </ReactMarkdown>
                {isGeneratingPhase && <StreamingIndicator />}
              </div>
            ) : isThinkingPhase ? (
              <ThinkingDots />
            ) : !isStreaming ? (
              <div className="prose-chat">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                  {cleanContent}
                </ReactMarkdown>
              </div>
            ) : null}
          </>
        )}
      </div>

      {suggestMatch && !isStreaming && (() => {
        const modeMap: Record<string, string> = { plan: '规划', create: '创建', chat: '对话' };
        const m = suggestMatch[1].toLowerCase();
        return (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mt-2.5 flex items-center justify-between rounded-lg bg-muted/15 px-2.5 py-1.5 border border-border/30">
            <span className="text-[10px] text-muted-foreground/80 font-sans">💡 建议切换到「{modeMap[m] || m}」模式</span>
            <button onClick={() => onModeSwitch?.(m)} className="flex items-center gap-1 text-[10px] font-medium text-primary/80 hover:text-primary transition-colors">
              进入 {modeMap[m] || m} <Navigation className="h-2.5 w-2.5 ml-0.5 opacity-70" />
            </button>
          </motion.div>
        );
      })()}
    </div>
  );
});
