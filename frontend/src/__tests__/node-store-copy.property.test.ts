import { describe, expect, it } from 'vitest';
import { matchesNodeStoreQuery, resolveNodeStoreCopy } from '@/components/layout/sidebar/resolve-node-store-copy';

describe('node store copy resolver', () => {
  it('prefers manifest display_name for the node store title', () => {
    const copy = resolveNodeStoreCopy('summary', {
      display_name: 'Manifest 总结标题',
      description: 'Manifest 描述',
    });

    expect(copy.title).toBe('Manifest 总结标题');
  });

  it('falls back to workflow meta title when manifest display_name is blank', () => {
    const copy = resolveNodeStoreCopy('summary', {
      display_name: '   ',
      description: 'Manifest 描述',
    });

    expect(copy.title).toBe('总结归纳');
  });

  it('prefers manifest description for the node store subtitle', () => {
    const copy = resolveNodeStoreCopy('summary', {
      display_name: 'Manifest 标题',
      description: '更具体的 Manifest 描述',
    });

    expect(copy.description).toBe('更具体的 Manifest 描述');
  });

  it('falls back to workflow meta description when manifest description is blank', () => {
    const copy = resolveNodeStoreCopy('summary', {
      display_name: 'Manifest 标题',
      description: '   ',
    });

    expect(copy.description).toBe('整理重点、结论与复习摘要');
  });

  it('matches queries against manifest display_name', () => {
    expect(matchesNodeStoreQuery('summary', {
      display_name: '高阶总结器',
      description: 'Manifest 描述',
    }, '总结器')).toBe(true);
  });

  it('matches queries against manifest description', () => {
    expect(matchesNodeStoreQuery('summary', {
      display_name: 'Manifest 标题',
      description: '适合冲刺复习的摘要节点',
    }, '冲刺复习')).toBe(true);
  });

  it('still matches workflow meta and raw node type without manifest copy', () => {
    expect(matchesNodeStoreQuery('summary', null, '总结归纳')).toBe(true);
    expect(matchesNodeStoreQuery('summary', null, 'summary')).toBe(true);
  });

  it('treats empty queries as a match', () => {
    expect(matchesNodeStoreQuery('summary', null, '   ')).toBe(true);
  });
});
