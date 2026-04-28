/**
 * Property tests for execution-state.ts — utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  EXECUTION_ACTIVITY_GRACE_MS,
  buildExecutionRequestBody,
  getExecutionFailureMessage,
  shouldFinalizeExecutionAsInterrupted,
} from '@/features/workflow/utils/execution-state';

describe('buildExecutionRequestBody', () => {
  it('wraps nodes and edges', () => {
    const nodes = [{ id: 'n1' }] as any;
    const edges = [{ id: 'e1' }] as any;
    const body = buildExecutionRequestBody(nodes, edges);
    expect(body.nodes_json).toBe(nodes);
    expect(body.edges_json).toBe(edges);
  });
});

describe('getExecutionFailureMessage', () => {
  it('returns HTTP message for HTTP errors', () => {
    const err = new Error('HTTP 500 Internal Server Error');
    const msg = getExecutionFailureMessage(err);
    expect(msg).toContain('HTTP 500');
    expect(msg).toContain('启动执行失败');
  });

  it('returns generic message for non-HTTP errors', () => {
    const msg = getExecutionFailureMessage(new Error('random'));
    expect(msg).toContain('异常中断');
  });

  it('handles non-Error values', () => {
    const msg = getExecutionFailureMessage('string error');
    expect(msg).toContain('异常中断');
  });

  it('handles null', () => {
    const msg = getExecutionFailureMessage(null);
    expect(typeof msg).toBe('string');
  });
});

describe('shouldFinalizeExecutionAsInterrupted', () => {
  const now = Date.now();

  it('returns false when completed', () => {
    expect(shouldFinalizeExecutionAsInterrupted(true, false, now, now - 999999)).toBe(false);
  });

  it('returns false when aborted', () => {
    expect(shouldFinalizeExecutionAsInterrupted(false, true, now, now - 999999)).toBe(false);
  });

  it('returns true when stale beyond grace', () => {
    const staleAt = now - EXECUTION_ACTIVITY_GRACE_MS - 1;
    expect(shouldFinalizeExecutionAsInterrupted(false, false, now, staleAt)).toBe(true);
  });

  it('returns false when within grace period', () => {
    const recentAt = now - EXECUTION_ACTIVITY_GRACE_MS + 1000;
    expect(shouldFinalizeExecutionAsInterrupted(false, false, now, recentAt)).toBe(false);
  });

  it('respects custom grace ms', () => {
    const lastActivity = now - 500;
    expect(shouldFinalizeExecutionAsInterrupted(false, false, now, lastActivity, 100)).toBe(true);
    expect(shouldFinalizeExecutionAsInterrupted(false, false, now, lastActivity, 1000)).toBe(false);
  });
});
