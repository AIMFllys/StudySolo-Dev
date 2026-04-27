/**
 * Property tests for trace-helpers.ts — trace utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  parseInputSummary,
  buildParallelGroupId,
  formatDuration,
  isTraceFinished,
} from '@/features/workflow/utils/trace-helpers';

describe('parseInputSummary', () => {
  it('returns empty for undefined', () => {
    expect(parseInputSummary(undefined)).toBe('');
  });

  it('returns empty for invalid JSON', () => {
    expect(parseInputSummary('not json')).toBe('');
  });

  it('extracts user_content', () => {
    const snap = JSON.stringify({ user_content: '学习 Python' });
    expect(parseInputSummary(snap)).toContain('Python');
  });

  it('truncates long content', () => {
    const snap = JSON.stringify({ user_content: 'a'.repeat(100) });
    const result = parseInputSummary(snap);
    expect(result).toContain('…');
  });

  it('shows upstream count', () => {
    const snap = JSON.stringify({ upstream_outputs: { a: 'x', b: 'y' } });
    expect(parseInputSummary(snap)).toContain('2');
  });

  it('combines both', () => {
    const snap = JSON.stringify({ user_content: 'task', upstream_outputs: { a: 'x' } });
    const result = parseInputSummary(snap);
    expect(result).toContain('task');
    expect(result).toContain('1');
  });
});

describe('buildParallelGroupId', () => {
  it('sorts and joins', () => {
    expect(buildParallelGroupId(['c', 'a', 'b'])).toBe('a|b|c');
  });

  it('single id', () => {
    expect(buildParallelGroupId(['x'])).toBe('x');
  });

  it('stable regardless of order', () => {
    expect(buildParallelGroupId(['b', 'a'])).toBe(buildParallelGroupId(['a', 'b']));
  });
});

describe('formatDuration', () => {
  it('0ms for undefined', () => {
    expect(formatDuration(undefined)).toBe('0ms');
  });

  it('0ms for zero', () => {
    expect(formatDuration(0)).toBe('0ms');
  });

  it('ms for small values', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('seconds for >= 1000', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('negative treated as 0', () => {
    expect(formatDuration(-100)).toBe('0ms');
  });
});

describe('isTraceFinished', () => {
  it('done is finished', () => {
    expect(isTraceFinished({ status: 'done' })).toBe(true);
  });

  it('error is finished', () => {
    expect(isTraceFinished({ status: 'error' })).toBe(true);
  });

  it('skipped is finished', () => {
    expect(isTraceFinished({ status: 'skipped' })).toBe(true);
  });

  it('running is not finished', () => {
    expect(isTraceFinished({ status: 'running' })).toBe(false);
  });

  it('pending is not finished', () => {
    expect(isTraceFinished({ status: 'pending' })).toBe(false);
  });
});
