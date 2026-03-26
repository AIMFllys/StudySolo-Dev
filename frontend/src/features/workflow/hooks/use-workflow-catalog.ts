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
 * Fetches the user-facing AI model catalog from `/api/ai/models/catalog`.
 *
 * Cache strategy:
 * - Hit:  same userId + tier → reuse cached models instantly.
 * - Miss: different user, different tier, or cold start → fetch fresh + update cache.
 *
 * This prevents cross-session pollution (User A's free-tier list leaking to User B's PRO session).
 */
export function useWorkflowCatalog() {
  const [models, setModels] = useState<AIModelOption[]>(_cache?.models ?? FALLBACK_AI_MODEL_OPTIONS);
  const [isLoading, setIsLoading] = useState(true);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

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

      // 3. Cache miss: fetch fresh catalog
      try {
        const all = await getUserAiModelCatalog();
        if (cancelled) return;
        const selectable = all.filter((m) => m.isEnabled && m.isUserSelectable);
        const result = selectable.length > 0 ? selectable : FALLBACK_AI_MODEL_OPTIONS;
        _cache = { userId, tier, models: result };
        setModels(result);
      } catch {
        if (!cancelled) {
          // Partial fallback: keep previous cache models if available, else use static fallback
          setModels(_cache?.models ?? FALLBACK_AI_MODEL_OPTIONS);
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
