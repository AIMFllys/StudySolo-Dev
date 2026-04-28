/**
 * Property tests for responsive-utils.ts — breakpoint constants and touch targets.
 */
import { describe, it, expect } from 'vitest';
import { BREAKPOINTS, TOUCH_TARGET, SAFE_AREA } from '@/lib/responsive-utils';

describe('BREAKPOINTS', () => {
  it('has standard Tailwind breakpoints', () => {
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
  });

  it('breakpoints are in ascending order', () => {
    const values = Object.values(BREAKPOINTS);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });
});

describe('TOUCH_TARGET', () => {
  it('min meets iOS HIG (44px)', () => {
    expect(TOUCH_TARGET.min).toBe(44);
  });

  it('recommended meets Material Design (48px)', () => {
    expect(TOUCH_TARGET.recommended).toBe(48);
  });

  it('comfortable is largest', () => {
    expect(TOUCH_TARGET.comfortable).toBeGreaterThan(TOUCH_TARGET.recommended);
  });
});

describe('SAFE_AREA', () => {
  it('has all four insets', () => {
    expect(SAFE_AREA.top).toContain('safe-area-inset-top');
    expect(SAFE_AREA.bottom).toContain('safe-area-inset-bottom');
    expect(SAFE_AREA.left).toContain('safe-area-inset-left');
    expect(SAFE_AREA.right).toContain('safe-area-inset-right');
  });
});
