/**
 * Responsive utility functions
 * Mobile-first responsive design helpers
 */

import { useMediaQuery } from '@/hooks/mobile';

// Breakpoint definitions matching TailwindCSS 4
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Check if current viewport is at or above a breakpoint
 */
export function useBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS[breakpoint]}px)`);
}

/**
 * Check if current viewport is below a breakpoint
 */
export function useBelowBreakpoint(breakpoint: Breakpoint): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`);
}

/**
 * Check if current viewport is between two breakpoints
 */
export function useBetweenBreakpoints(min: Breakpoint, max: Breakpoint): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS[min]}px) and (max-width: ${BREAKPOINTS[max] - 1}px)`
  );
}

/**
 * Get responsive value based on current breakpoint
 * Usage: const value = useResponsiveValue({ sm: 'small', md: 'medium', lg: 'large' });
 */
export function useResponsiveValue<T>(values: Partial<Record<Breakpoint | 'default', T>>): T | undefined {
  const isSm = useBreakpoint('sm');
  const isMd = useBreakpoint('md');
  const isLg = useBreakpoint('lg');
  const isXl = useBreakpoint('xl');
  const is2xl = useBreakpoint('2xl');

  if (is2xl && values['2xl'] !== undefined) return values['2xl'];
  if (isXl && values.xl !== undefined) return values.xl;
  if (isLg && values.lg !== undefined) return values.lg;
  if (isMd && values.md !== undefined) return values.md;
  if (isSm && values.sm !== undefined) return values.sm;
  return values.default;
}

/**
 * Responsive column count for grids
 */
export function useResponsiveColumns(): number {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isLarge = useMediaQuery('(min-width: 1280px)');

  if (isLarge) return 4;
  if (isDesktop) return 3;
  if (isTablet) return 2;
  if (isMobile) return 1;
  return 1;
}

/**
 * Touch target size constants (following iOS HIG)
 */
export const TOUCH_TARGET = {
  min: 44, // iOS minimum
  recommended: 48, // Material Design recommended
  comfortable: 56, // Larger touch targets
} as const;

/**
 * Safe area insets for notched devices
 */
export const SAFE_AREA = {
  top: 'env(safe-area-inset-top)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
  right: 'env(safe-area-inset-right)',
} as const;
