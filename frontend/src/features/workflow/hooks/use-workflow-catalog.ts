'use client';

import { useState, useEffect, useRef } from 'react';
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
 */
export function useWorkflowCatalog() {
  // CRITICAL FIX: Do NOT pre-seed state with FALLBACK.
  // Start with empty array while loading; only use FALLBACK if the request fails.
  // This prevents the initial render from permanently showing only DeepSeek.
  const [models, setModels] = useState<AIModelOption[]>(_cache?.models ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // If cache is already populated, use it immediately (no loading flash)
    if (_cache) {
      setModels(_cache.models);
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function init() {
      // 1. Identify current user for cache key
      const user = await getUser().catch(() => null);
      const userId = user?.id ?? 'anonymous';
      const tier = (user as Record<string, string> | null)?.tier ?? 'free';

      // 2. Cache hit: same user+tier, serve immediately
      if (_cache && _cache.userId === userId && _cache.tier === tier) {
        if (!cancelled) {
          setModels(_cache.models);
          setIsLoading(false);
        }
        return;
      }

      // 3. Cache miss: fetch full catalog (all visible models, tier-agnostic)
      try {
        const all = await getUserAiModelCatalog();
        if (cancelled) return;

        // Only filter out non-selectable and disabled; keep all tiers for Upsell UI
        const selectable = all.filter((m) => m.isEnabled && m.isUserSelectable);
        const result = selectable.length > 0 ? selectable : FALLBACK_AI_MODEL_OPTIONS;

        _cache = { userId, tier, models: result };
        setModels(result);
      } catch {
        if (!cancelled) {
          // Degraded mode: use existing cache or static fallback
          // Never leave the user with an empty model list
          const degraded = _cache?.models ?? FALLBACK_AI_MODEL_OPTIONS;
          setModels(degraded);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
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
}
