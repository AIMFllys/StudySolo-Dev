'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Navigation } from 'lucide-react';
import 'katex/dist/katex.min.css';

import { PlanCard } from './PlanCard';
import { MagicWandLoader, StudySoloIcon } from './MagicWandLoader';
import { AgentSegments } from './agent-segments/AgentSegments';
import { adaptChatMessage } from './chat-message-adapter';
import type { ChatEntry } from '@/stores/chat/use-conversation-store';

function WaitingForFirstToken() {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <MagicWandLoader />
      <span className="text-[10px] font-medium tracking-wider text-muted-foreground/50 font-sans">
        正在思考…
      </span>
    </div>
  );
}

function hasAnyRenderableSegment(entry: ChatEntry): boolean {
  return Array.isArray(entry.segments) && entry.segments.length > 0;
}

function SuggestModeChip({
  mode,
  onModeSwitch,
}: {
  mode: string;
  onModeSwitch?: (mode: string) => void;
}) {
  const modeMap: Record<string, string> = { plan: '规划', create: '创建', chat: '对话' };
  const label = modeMap[mode] || mode;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="mt-2.5 flex items-center justify-between rounded-lg bg-muted/15 px-2.5 py-1.5 border border-border/30"
    >
      <span className="text-[10px] text-muted-foreground/80 font-sans">
        建议切换到「{label}」模式
      </span>
      <button
        onClick={() => onModeSwitch?.(mode)}
        className="flex items-center gap-1 text-[10px] font-medium text-primary/80 hover:text-primary transition-colors"
      >
        进入 {label} <Navigation className="h-2.5 w-2.5 ml-0.5 opacity-70" />
      </button>
    </motion.div>
  );
}

export const AIMessage = memo(function AIMessage({
  entry, isStreaming, onModeSwitch,
}: {
  entry: ChatEntry; isStreaming: boolean; onModeSwitch?: (mode: string) => void;
}) {
  const renderModel = adaptChatMessage(entry);
  const waitingForFirstToken =
    isStreaming &&
    renderModel.segments.length === 0 &&
    !renderModel.rawPlanContent.trim();
  const streamedSegments = hasAnyRenderableSegment(entry) ? renderModel.segments : undefined;

  return (
    <div className="ai-msg-root">
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10">
          <StudySoloIcon className="h-3 w-3 text-primary/80" />
        </div>
        <span className="text-[10px] font-medium tracking-wider text-muted-foreground/50 font-sans">
          StudySolo AI
        </span>
      </div>

      <div className="chat-markdown-body pl-0.5">
        {waitingForFirstToken ? (
          <WaitingForFirstToken />
        ) : renderModel.hasPlan ? (
          <PlanCard
            rawContent={renderModel.rawPlanContent}
            segments={streamedSegments}
            isStreaming={isStreaming}
          />
        ) : (
          <AgentSegments
            segments={renderModel.segments}
            summary={renderModel.summary}
            isStreaming={isStreaming}
          />
        )}
      </div>

      {renderModel.suggestMode && !isStreaming && (
        <SuggestModeChip mode={renderModel.suggestMode} onModeSwitch={onModeSwitch} />
      )}
    </div>
  );
});
