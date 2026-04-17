'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { markdownComponents } from '../chat-markdown-components';
import { stripSuggestModeMarker } from '../chat-message-adapter';

interface AnswerSegmentProps {
  text: string;
  isStreaming?: boolean;
}

export const AnswerSegment = memo(function AnswerSegment({ text, isStreaming }: AnswerSegmentProps) {
  const clean = stripSuggestModeMarker(text);
  if (!clean) {
    return isStreaming ? (
      <div className="flex items-center gap-1.5 py-1">
        <span className="flex gap-[3px]">
          <span className="h-1 w-1 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-primary/30 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    ) : null;
  }
  return (
    <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {clean}
      </ReactMarkdown>
      {isStreaming && (
        <div className="flex items-center gap-1.5 mt-2 pb-0.5">
          <span className="flex gap-[3px]">
            <span className="h-1 w-1 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
            <span className="h-1 w-1 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
            <span className="h-1 w-1 rounded-full bg-primary/30 animate-bounce [animation-delay:300ms]" />
          </span>
          <span className="text-[10px] text-muted-foreground/50 font-sans tracking-wider">
            Generating...
          </span>
        </div>
      )}
    </div>
  );
});
