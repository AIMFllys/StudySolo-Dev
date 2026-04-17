'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, XCircle, Wrench } from 'lucide-react';

interface ToolCallSegmentProps {
  tool: string;
  params: unknown;
  status: 'running' | 'ok' | 'error';
  result?: unknown;
  error?: string;
}

function tryPretty(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function paramsSummary(params: unknown): string {
  if (!params || typeof params !== 'object') return '';
  const entries = Object.entries(params as Record<string, unknown>);
  if (entries.length === 0) return '';
  const parts = entries.slice(0, 3).map(([k, v]) => {
    let s: string;
    if (typeof v === 'string') s = v.length > 24 ? `${v.slice(0, 24)}…` : v;
    else if (typeof v === 'number' || typeof v === 'boolean') s = String(v);
    else if (Array.isArray(v)) s = `[${v.length}]`;
    else s = '{…}';
    return `${k}=${s}`;
  });
  if (entries.length > 3) parts.push('…');
  return parts.join(', ');
}

export const ToolCallSegment = memo(function ToolCallSegment({
  tool,
  params,
  status,
  result,
  error,
}: ToolCallSegmentProps) {
  const [expanded, setExpanded] = useState(false);
  const summary = paramsSummary(params);

  const StatusIcon = () => {
    if (status === 'running') return <Loader2 className="h-3 w-3 animate-spin text-primary/70" />;
    if (status === 'ok') return <CheckCircle2 className="h-3 w-3 text-emerald-500/80" />;
    return <XCircle className="h-3 w-3 text-red-500/80" />;
  };

  const label =
    status === 'running'
      ? '调用中'
      : status === 'ok'
        ? '完成'
        : '失败';

  return (
    <div className="my-1.5 rounded-lg border-[1.5px] border-border/30 bg-muted/15 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-muted/25 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        )}
        <Wrench className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] font-medium font-sans text-foreground/80 truncate">{tool}</span>
        {summary && (
          <span className="text-[10px] text-muted-foreground/60 font-mono truncate">
            ({summary})
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/70 font-sans">
          <StatusIcon />
          <span>{label}</span>
        </span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 text-[10px] leading-relaxed font-mono text-muted-foreground/80 space-y-1.5">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">参数</div>
            <pre className="whitespace-pre-wrap break-words bg-background/40 p-1.5 rounded">
              {tryPretty(params) || '（空）'}
            </pre>
          </div>
          {status !== 'running' && (
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground/50 mb-0.5">
                {status === 'ok' ? '返回' : '错误'}
              </div>
              <pre className="whitespace-pre-wrap break-words bg-background/40 p-1.5 rounded">
                {status === 'ok' ? tryPretty(result) || '（空）' : error || '未知错误'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
