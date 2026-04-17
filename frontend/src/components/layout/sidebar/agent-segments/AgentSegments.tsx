'use client';

import { memo, useMemo } from 'react';
import { ThinkingCard } from '../ThinkingCard';
import type { ChatSegment, ChatSummaryChange } from '@/stores/chat/use-conversation-store';
import { parseThinking } from '@/features/workflow/utils/parse-thinking';
import { ToolCallSegment } from './ToolCallSegment';
import { AnswerSegment } from './AnswerSegment';
import { SummarySegment } from './SummarySegment';

interface AgentSegmentsProps {
  segments: ChatSegment[];
  summary?: ChatSummaryChange[];
  isStreaming?: boolean;
}

/** Does an answer blob still contain literal `<think>` or `<thinking>` tags? */
function answerNeedsRescue(text: string): boolean {
  return /<think(?:ing)?[\s>]/i.test(text);
}

export const AgentSegments = memo(function AgentSegments({
  segments,
  summary,
  isStreaming,
}: AgentSegmentsProps) {
  // Rescue: if the backend delivered a single `answer` segment that still
  // carries raw `<think>…</think>` literals (e.g. an older response snapshot
  // or a model whose reasoning slipped past the parser), pull the reasoning
  // out locally and surface it as a proper Thinking card.
  const { derivedThinking, sanitizedSegments } = useMemo(() => {
    let derived = '';
    const out: ChatSegment[] = segments.map((seg) => {
      if (seg.kind !== 'answer') return seg;
      if (!('text' in seg) || !answerNeedsRescue(seg.text)) return seg;
      // Normalise `<thinking>` → `<think>` so parseThinking can pick it up.
      const normalized = seg.text
        .replace(/<thinking>/gi, '<think>')
        .replace(/<\/thinking>/gi, '</think>');
      const { thinking: th, answer: ans } = parseThinking(normalized);
      if (th) derived += (derived ? '\n\n' : '') + th;
      return { ...seg, text: ans };
    });
    return { derivedThinking: derived, sanitizedSegments: out };
  }, [segments]);

  const thinkingTexts = sanitizedSegments
    .filter((s) => s.kind === 'thinking')
    .map((s) => ('text' in s ? s.text : ''));
  const mergedThinking = [derivedThinking, thinkingTexts.join('\n\n')]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  const hasAnswer = sanitizedSegments.some(
    (s) => s.kind === 'answer' && 'text' in s && s.text.trim().length > 0,
  );

  return (
    <div className="flex flex-col">
      {mergedThinking && (
        <ThinkingCard
          thinking={mergedThinking}
          isStreaming={Boolean(isStreaming) && !hasAnswer}
        />
      )}

      {sanitizedSegments.map((seg) => {
        // Summary parent + its XML children are rendered separately as SummarySegment.
        if (
          seg.kind === 'thinking' ||
          seg.kind === 'summary' ||
          (typeof seg.kind === 'string' && seg.kind.startsWith('summary.'))
        ) {
          return null;
        }
        // Tool_use inner segments (params/name) are subsumed by the ToolCallSegment card.
        if (typeof seg.kind === 'string' && seg.kind.startsWith('tool_use')) {
          return null;
        }
        if (seg.kind === 'tool_call') {
          return (
            <ToolCallSegment
              key={seg.id}
              tool={seg.tool}
              params={seg.params}
              status={seg.status}
              result={seg.result}
              error={seg.error}
            />
          );
        }
        if (seg.kind === 'answer') {
          return (
            <AnswerSegment
              key={seg.id}
              text={seg.text}
              isStreaming={Boolean(isStreaming)}
            />
          );
        }
        // Other tags (plan.*, warning) — fall back to small gray text
        if (seg.text) {
          return (
            <div
              key={seg.id}
              className="text-[11px] leading-relaxed text-muted-foreground/80 whitespace-pre-wrap"
            >
              {seg.text}
            </div>
          );
        }
        return null;
      })}

      {!isStreaming && summary && summary.length > 0 && <SummarySegment items={summary} />}
    </div>
  );
});
