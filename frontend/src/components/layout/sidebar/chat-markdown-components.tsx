'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-white/5 text-muted-foreground/60 opacity-0 transition-all hover:bg-white/10 hover:text-foreground/80 group-hover:opacity-100"
      title="复制代码"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export const markdownComponents = {
  p: ({ children, ...props }: React.ComponentProps<'p'>) => (
    <p className="mb-2 last:mb-0 leading-[1.7] text-foreground/85" {...props}>{children}</p>
  ),
  h1: ({ children, ...props }: React.ComponentProps<'h1'>) => (
    <h1 className="mb-2 mt-3 text-[15px] font-bold text-foreground/95 font-serif" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2 className="mb-2 mt-3 text-[14px] font-bold text-foreground/90 font-serif" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<'h3'>) => (
    <h3 className="mb-1.5 mt-2.5 text-[13px] font-semibold text-foreground/90 font-serif" {...props}>{children}</h3>
  ),
  ul: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul className="mb-2 ml-4 list-disc space-y-0.5 text-foreground/80 marker:text-primary/40" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<'ol'>) => (
    <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-foreground/80" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li className="leading-[1.6]" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
    <blockquote className="my-2 border-l-2 border-primary/30 pl-3 text-muted-foreground/80 italic" {...props}>{children}</blockquote>
  ),
  strong: ({ children, ...props }: React.ComponentProps<'strong'>) => (
    <strong className="font-semibold text-foreground/95" {...props}>{children}</strong>
  ),
  a: ({ children, href, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} className="text-primary/80 underline decoration-primary/30 underline-offset-2 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  table: ({ children, ...props }: React.ComponentProps<'table'>) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border/30">
      <table className="w-full text-[11px]" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }: React.ComponentProps<'th'>) => (
    <th className="border-b border-border/30 bg-muted/20 px-2 py-1.5 text-left font-semibold text-foreground/80" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.ComponentProps<'td'>) => (
    <td className="border-b border-border/20 px-2 py-1.5 text-foreground/70" {...props}>{children}</td>
  ),
  hr: (props: React.ComponentProps<'hr'>) => (
    <hr className="my-3 border-border/20" {...props} />
  ),
  code: ({ className, children, ...props }: React.ComponentProps<'code'> & { className?: string }) => {
    const match = className?.match(/language-(\w+)/);
    const codeString = String(children).replace(/\n$/, '');
    if (match) {
      return (
        <div className="group relative my-2 rounded-lg border border-border/20 bg-[#0d1117] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-1">
            <span className="text-[10px] text-muted-foreground/50 font-mono">{match[1]}</span>
            <CopyButton text={codeString} />
          </div>
          <pre className="overflow-x-auto p-3 text-[11px] leading-[1.6]">
            <code className={`${className} font-mono text-foreground/85`} {...props}>{children}</code>
          </pre>
        </div>
      );
    }
    return (
      <code className="rounded-[4px] bg-muted/30 px-1.5 py-0.5 text-[11px] font-mono text-primary/80 border border-border/20" {...props}>{children}</code>
    );
  },
};
