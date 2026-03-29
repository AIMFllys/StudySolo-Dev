'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AIMessage } from './AIMessage';
import { ChatEmptyState, SkeletonLoader } from './ChatEmptyState';

interface HistoryEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface ChatMessagesProps {
  history: HistoryEntry[];
  loading: boolean;
  streaming: boolean;
  streamingMessageId: string | null;
  lastPrompt: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onModeSwitch?: (mode: string) => void;
}

function UserMessage({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="ml-auto max-w-[88%]">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2 text-[12px] leading-[1.65] text-foreground/90 font-serif">
        {entry.content}
      </div>
    </div>
  );
}

export function ChatMessages({ history, loading, streaming, streamingMessageId, lastPrompt, scrollRef, onModeSwitch }: ChatMessagesProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: streaming ? 'auto' : 'smooth' });
    }
  }, [history, streaming]);

  if (history.length === 0) {
    return <ChatEmptyState lastPrompt={lastPrompt} scrollRef={scrollRef} />;
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="space-y-5 p-4">
        <AnimatePresence initial={false}>
          {history.map((entry) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {entry.role === 'user' ? (
                <UserMessage entry={entry} />
              ) : (
                <AIMessage entry={entry} isStreaming={streaming && entry.id === streamingMessageId} onModeSwitch={onModeSwitch} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && !streaming && <SkeletonLoader />}
        <div ref={endRef} />
      </div>
    </div>
  );
}
