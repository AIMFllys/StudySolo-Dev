/**
 * Property tests for workflow-meta.ts — status meta, node preview, node title.
 */
import { describe, it, expect } from 'vitest';
import { STATUS_META, getStatusMeta, getNodePreview, getNodeTitle } from '@/features/workflow/constants/workflow-meta';

describe('STATUS_META', () => {
  const allStatuses = ['pending', 'running', 'waiting', 'done', 'error', 'paused', 'skipped'] as const;

  it.each(allStatuses)('%s has required fields', (status) => {
    const meta = STATUS_META[status];
    expect(meta.label).toBeTruthy();
    expect(meta.badgeClassName).toBeTruthy();
    expect(meta.dotClassName).toBeTruthy();
  });
});

describe('getStatusMeta', () => {
  it('returns meta for known status', () => {
    expect(getStatusMeta('done').label).toBe('已完成');
  });

  it('falls back to pending for unknown', () => {
    expect(getStatusMeta('nonexistent').label).toBe('待执行');
  });

  it('falls back for undefined', () => {
    expect(getStatusMeta(undefined).label).toBe('待执行');
  });
});

describe('getNodePreview', () => {
  it('returns fallback for empty', () => {
    expect(getNodePreview('')).toContain('等待');
  });

  it('returns fallback for undefined', () => {
    expect(getNodePreview(undefined)).toContain('等待');
  });

  it('strips markdown', () => {
    const result = getNodePreview('# Hello **world**');
    expect(result).not.toContain('#');
    expect(result).not.toContain('*');
  });

  it('replaces code blocks', () => {
    const result = getNodePreview('before ```code``` after');
    expect(result).toContain('代码块');
  });

  it('truncates long text', () => {
    const result = getNodePreview('a'.repeat(200));
    expect(result.length).toBeLessThanOrEqual(96);
  });

  it('custom fallback', () => {
    expect(getNodePreview('', '自定义')).toBe('自定义');
  });
});

describe('getNodeTitle', () => {
  it('uses label from data', () => {
    expect(getNodeTitle({ id: 'n1', type: 'summary', data: { label: 'My Node' } })).toBe('My Node');
  });

  it('falls back to type meta label', () => {
    const title = getNodeTitle({ id: 'n1', type: 'summary', data: {} });
    expect(title).toBe('总结归纳');
  });

  it('trims whitespace', () => {
    expect(getNodeTitle({ id: 'n1', type: 'summary', data: { label: '  Spaced  ' } })).toBe('Spaced');
  });
});
