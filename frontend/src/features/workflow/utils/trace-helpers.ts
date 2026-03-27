import type { NodeExecutionTrace } from '@/types';

export function parseInputSummary(rawSnapshot: string | undefined): string {
  if (!rawSnapshot) {
    return '';
  }

  try {
    const parsed = JSON.parse(rawSnapshot) as {
      user_content?: string;
      upstream_outputs?: Record<string, unknown>;
    };
    const parts: string[] = [];

    if (parsed.user_content) {
      const trimmed = String(parsed.user_content).trim();
      const preview = trimmed.slice(0, 60);
      parts.push(`任务: ${preview}${trimmed.length > 60 ? '…' : ''}`);
    }

    const upstreamCount = Object.keys(parsed.upstream_outputs ?? {}).length;
    if (upstreamCount > 0) {
      parts.push(`接收了 ${upstreamCount} 个上游输出`);
    }

    return parts.join(' · ');
  } catch {
    return '';
  }
}

export function buildParallelGroupId(nodeIds: string[]): string {
  return [...nodeIds].sort().join('|');
}

export function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) {
    return '0ms';
  }
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function isTraceFinished(trace: Pick<NodeExecutionTrace, 'status'>): boolean {
  return trace.status === 'done' || trace.status === 'error' || trace.status === 'skipped';
}
