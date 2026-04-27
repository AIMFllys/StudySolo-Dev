/**
 * Property tests for node-config-utils.ts — buildDefaultConfig.
 */
import { describe, it, expect } from 'vitest';
import { buildDefaultConfig } from '@/features/workflow/components/node-config/node-config-utils';

describe('buildDefaultConfig', () => {
  it('returns empty for empty schema', () => {
    expect(buildDefaultConfig([])).toEqual({});
  });

  it('extracts defaults', () => {
    const schema = [
      { key: 'length', type: 'select', label: 'Length', default: 'balanced' },
      { key: 'style', type: 'select', label: 'Style', default: 'notes' },
    ];
    expect(buildDefaultConfig(schema as any)).toEqual({ length: 'balanced', style: 'notes' });
  });

  it('skips fields without default', () => {
    const schema = [
      { key: 'a', type: 'text', label: 'A', default: 'val' },
      { key: 'b', type: 'text', label: 'B' },
    ];
    const result = buildDefaultConfig(schema as any);
    expect(result).toEqual({ a: 'val' });
    expect('b' in result).toBe(false);
  });

  it('handles false/0 defaults', () => {
    const schema = [
      { key: 'flag', type: 'checkbox', label: 'Flag', default: false },
      { key: 'count', type: 'number', label: 'Count', default: 0 },
    ];
    const result = buildDefaultConfig(schema as any);
    expect(result.flag).toBe(false);
    expect(result.count).toBe(0);
  });
});
