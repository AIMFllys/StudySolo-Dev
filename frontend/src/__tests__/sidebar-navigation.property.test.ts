import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  isSettingsRouteActive,
  isWorkflowRouteActive,
} from '@/hooks/use-sidebar-navigation';
import { formatMonthDay } from '@/utils/date';

describe('sidebar navigation helpers', () => {
  it('workflow route is active only when pathname exactly matches workspace id route', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.string(), (workflowId, randomTail) => {
        const exactPath = `/c/${workflowId}`;
        const nonExactPath = `/c/${workflowId}/${randomTail}`;

        expect(isWorkflowRouteActive(exactPath, workflowId)).toBe(true);
        expect(isWorkflowRouteActive(nonExactPath, workflowId)).toBe(false);
      }),
      { numRuns: 120 }
    );
  });

  it('settings route is active only for exact /settings path', () => {
    fc.assert(
      fc.property(fc.string(), (tail) => {
        const path = tail.startsWith('/') ? tail : `/${tail}`;
        expect(isSettingsRouteActive('/settings')).toBe(true);
        if (path !== '/settings') {
          expect(isSettingsRouteActive(path)).toBe(false);
        }
      }),
      { numRuns: 120 }
    );
  });

  it('formatMonthDay falls back to raw input for invalid date strings', () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter((value) => value.length > 0)
          .filter((value) => Number.isNaN(new Date(value).getTime())),
        (invalidIso) => {
          expect(formatMonthDay(invalidIso, 'zh-CN')).toBe(invalidIso);
        }
      ),
      { numRuns: 120 }
    );
  });
});
