'use client';

import { useEffect, useState } from 'react';
import type { WorkflowExecutionSession } from '@/types';
import { formatDuration } from '@/features/workflow/utils/trace-helpers';

interface ExecutionProgressHeaderProps {
  session: WorkflowExecutionSession;
  onClose: () => void;
}

export function ExecutionProgressHeader({ session, onClose }: ExecutionProgressHeaderProps) {
  const [elapsedMs, setElapsedMs] = useState(() =>
    session.totalDurationMs ?? Math.round(performance.now() - session.startedAt),
  );

  useEffect(() => {
    if (session.overallStatus !== 'running') {
      setElapsedMs(session.totalDurationMs ?? elapsedMs);
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedMs(Math.round(performance.now() - session.startedAt));
    }, 500);

    return () => window.clearInterval(timer);
  }, [elapsedMs, session.overallStatus, session.startedAt, session.totalDurationMs]);

  const progress = session.totalCount > 0
    ? Math.min(100, Math.round((session.completedCount / session.totalCount) * 100))
    : 0;

  return (
    <div className="border-b border-black/10 bg-background/95 px-4 py-4 backdrop-blur-sm dark:border-white/10">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">执行追踪</div>
          <div className="mt-1 text-sm font-medium text-foreground">{session.workflowId}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          关闭
        </button>
      </div>

      <div className="mb-2 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{session.completedCount} / {session.totalCount} 步</span>
        <span>{formatDuration(elapsedMs)}</span>
      </div>
    </div>
  );
}
