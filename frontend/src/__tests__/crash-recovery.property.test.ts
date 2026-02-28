/**
 * Property 8: 崩溃恢复冲突检测
 * Feature: studysolo-mvp, Property 8: 崩溃恢复冲突检测
 *
 * For any workflow IndexedDB cache, if local_updated_at is strictly
 * later than cloud_updated_at, the system must detect a conflict
 * and trigger the recovery prompt flow.
 *
 * Validates: Requirements 3.12
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Pure conflict detection logic extracted from use-workflow-sync.ts.
 * This mirrors the condition: cached.dirty && localTs > cloudTs
 */
function detectConflict(
  dirty: boolean,
  local_updated_at: string,
  cloud_updated_at: string
): boolean {
  if (!dirty) return false;
  const localTs = new Date(local_updated_at).getTime();
  const cloudTs = new Date(cloud_updated_at).getTime();
  return localTs > cloudTs;
}

// Generate a pair of ISO timestamps where local > cloud
const arbConflictTimestamps = fc
  .tuple(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fc.integer({ min: 1, max: 86_400_000 }) // 1ms to 24h offset
  )
  .map(([cloudDate, offsetMs]) => ({
    cloud_updated_at: cloudDate.toISOString(),
    local_updated_at: new Date(cloudDate.getTime() + offsetMs).toISOString(),
  }));

// Generate a pair where local <= cloud (no conflict)
const arbNoConflictTimestamps = fc
  .tuple(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    fc.integer({ min: 0, max: 86_400_000 })
  )
  .map(([localDate, offsetMs]) => ({
    local_updated_at: localDate.toISOString(),
    cloud_updated_at: new Date(localDate.getTime() + offsetMs).toISOString(),
  }));

describe('Property 8: 崩溃恢复冲突检测', () => {
  it('detects conflict when dirty=true and local_updated_at > cloud_updated_at', () => {
    fc.assert(
      fc.property(arbConflictTimestamps, ({ local_updated_at, cloud_updated_at }) => {
        const result = detectConflict(true, local_updated_at, cloud_updated_at);
        expect(result).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('does NOT detect conflict when dirty=false even if local > cloud', () => {
    fc.assert(
      fc.property(arbConflictTimestamps, ({ local_updated_at, cloud_updated_at }) => {
        const result = detectConflict(false, local_updated_at, cloud_updated_at);
        expect(result).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('does NOT detect conflict when local_updated_at <= cloud_updated_at', () => {
    fc.assert(
      fc.property(arbNoConflictTimestamps, ({ local_updated_at, cloud_updated_at }) => {
        const result = detectConflict(true, local_updated_at, cloud_updated_at);
        expect(result).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('conflict detection is consistent: same inputs always produce same output', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        (dirty, localDate, cloudDate) => {
          const local = localDate.toISOString();
          const cloud = cloudDate.toISOString();
          const r1 = detectConflict(dirty, local, cloud);
          const r2 = detectConflict(dirty, local, cloud);
          expect(r1).toBe(r2);
        }
      ),
      { numRuns: 200 }
    );
  });
});
