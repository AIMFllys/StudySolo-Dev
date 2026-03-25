'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Streamdown } from 'streamdown';
import 'katex/dist/katex.min.css';
import ShikiCodeBlock from './ShikiCodeBlock';

interface Props {
  content: string;
  /** When true, uses streamdown incremental rendering instead of react-markdown full render */
  streaming?: boolean;
}

/**
 * Markdown output renderer for workflow nodes.
 *
 * - streaming=true  → streamdown incremental DOM updates (avoids React re-renders)
 * - streaming=false → react-markdown + shiki full render (accurate final result)
 * - Auto-scrolls to bottom when content appends during streaming
 */
export default function NodeMarkdownOutput({ content, streaming = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes during streaming
  useEffect(() => {
    if (streaming && containerRef.current) {
      const el = containerRef.current;
      // Only auto-scroll if user is near the bottom (within 100px)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [content, streaming]);

  if (streaming) {
    return (
      <div
        ref={containerRef}
        className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-y-auto"
      >
        <Streamdown
          mode="streaming"
          shikiTheme={['github-light', 'github-dark']}
        >
          {content}
        </Streamdown>
      </div>
    );
  }

  // Full render with react-markdown + shiki for accurate final result
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({ className, children, ...props }) {
            const match = className?.match(/language-(\w+)/);
            if (match) {
              const code = String(children).replace(/\n$/, '');
              return <ShikiCodeBlock code={code} lang={match[1]} />;
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
