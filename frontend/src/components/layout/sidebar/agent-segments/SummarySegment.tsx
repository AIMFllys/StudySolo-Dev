'use client';

import { memo } from 'react';
import { CheckCheck } from 'lucide-react';
import type { ChatSummaryChange } from '@/stores/chat/use-conversation-store';

interface SummarySegmentProps {
  items: ChatSummaryChange[];
}

export const SummarySegment = memo(function SummarySegment({ items }: SummarySegmentProps) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-2.5 rounded-lg border-[1.5px] border-emerald-500/20 bg-emerald-500/5 p-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <CheckCheck className="h-3 w-3 text-emerald-600/80" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/80 font-sans">
          本轮变更
        </span>
      </div>
      <ul className="space-y-1 pl-1">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-start gap-1.5 text-[11px] leading-relaxed text-foreground/85"
          >
            <span className="mt-[3px] inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-500/60" />
            <span className="break-words">{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
});
