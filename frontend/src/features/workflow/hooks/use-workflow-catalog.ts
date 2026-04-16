'use client';

import { useState, useEffect } from 'react';
import { getUserAiModelCatalog } from '@/services/ai-catalog.service';
import { FALLBACK_AI_MODEL_OPTIONS, type AIModelOption } from '../constants/ai-models';
import { getUser } from '@/services/auth.service';

interface CacheEntry {
  userId: string;
  tier: string;
  models: AIModelOption[];
}

// Module-level cache keyed by user identity (userId + tier).
// Invalidated automatically when these change to prevent cross-session pollution.
let _cache: CacheEntry | null = null;
// Global in-flight promise: prevents N nodes from triggering N parallel API calls.
let _inflight: Promise<AIModelOption[]> | null = null;

/**
 * Fetches the full visible AI model catalog from `/api/ai/models/catalog`.
 *
 * IMPORTANT: The catalog now returns ALL visible models regardless of user tier.
 * Tier-based access control is handled at the UI layer (greyed-out PRO badge)
 * and enforced at the execution layer (403 on unauthorized model use).
 *
 * Cache strategy:
 * - Hit:  same userId + tier → reuse cached models instantly.
 * - Miss: different user, different tier, or cold start → fetch fresh.
 * - Error: degraded to FALLBACK_AI_MODEL_OPTIONS (static list).
 *
 * Bug fixed:
 * - setIsLoading(false) was only called inside `finally { if (!cancelled) ... }`.
 *   When a component unmounts (cancelled=true) before the promise resolves,
 *   any re-mount would restart with isLoading=true but didInit.current=true
 *   (module cache), so setIsLoading(false) was never called → stuck loading.
 * - N workflow nodes mounting simultaneously triggered N parallel fetches,
 *   each with its own 401 → tryRestoreSession → possible redirectToLogin.
 *   Fixed by a module-level _inflight promise dedup.
 */
export function useWorkflowCatalog() {
  const [models, setModels] = useState<AIModelOption[]>(_cache?.models ?? []);
  // Start isLoading=false immediately if module-level cache is already populated.
  const [isLoading, setIsLoading] = useState<boolean>(!_cache);

  useEffect(() => {
    // Fast path: cache already filled (from a previous node mount this session)
    if (_cache) {
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        // Identify user for cache keying — never throws (401 caught to null)
        const user = await getUser().catch(() => null);
        if (cancelled) return;

        const userId = user?.id ?? 'anonymous';
        const tier = (user as Record<string, string> | null)?.tier ?? 'free';

        // Re-check cache after awaiting getUser (another node may have filled it)
        if (_cache && _cache.userId === userId && _cache.tier === tier) {
          if (!cancelled) { setModels(_cache.models); setIsLoading(false); }
          return;
        }

        // Deduplicate parallel fetches: reuse in-flight promise if one already exists
        if (!_inflight) {
          _inflight = getUserAiModelCatalog().finally(() => { _inflight = null; });
        }
        const all = await _inflight;
        if (cancelled) return;

        const selectable = all.filter((m) => m.isEnabled && m.isUserSelectable);
        const result = selectable.length > 0 ? selectable : FALLBACK_AI_MODEL_OPTIONS;
        _cache = { userId, tier, models: result };
        setModels(result);
        setIsLoading(false);
      } catch {
        if (!cancelled) {
          // Degraded mode: static fallback — never leave the node with a broken selector
          const degraded = _cache?.models ?? FALLBACK_AI_MODEL_OPTIONS;
          setModels(degraded);
          setIsLoading(false);
        }
      }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  return { models, isLoading };
}

/**
 * Invalidate the module-level catalog cache.
 * Call this after user tier upgrades, logout, or admin catalog changes.
 */
export function invalidateWorkflowCatalogCache() {
  _cache = null;
  _inflight = null;
}
