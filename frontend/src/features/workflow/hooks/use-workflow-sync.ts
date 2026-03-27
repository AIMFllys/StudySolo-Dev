'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import localforage from 'localforage';
import { toast } from 'sonner';
import { authedFetch } from '@/services/api-client';
import { useWorkflowStore } from '@/stores/use-workflow-store';
import type { Node, Edge } from '@xyflow/react';

export type SyncStatus = 'synced' | 'saving_local' | 'saving_cloud' | 'offline' | 'error';

export interface LocalWorkflowCache {
  workflow_id: string;
  nodes: Node[];
  edges: Edge[];
  dirty: boolean;
  local_updated_at: string;
  cloud_updated_at: string;
}

export interface UseWorkflowSync {
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  forceSave: () => Promise<void>;
}

// ── Config ────────────────────────────────────────────────────────────────────
const SNAPSHOT_INTERVAL_MS = 2000;      // Take snapshot every 2s
const CLOUD_THROTTLE_MS   = 8000;      // Upload to cloud at most every 8s
const KEEPALIVE_MAX_BYTES = 60_000;    // Stay under browser 64KB keepalive limit

function cacheKey(id: string) {
  return `workflow_cache_${id}`;
}

// ── Minimal fast comparison ───────────────────────────────────────────────────
// Avoid full JSON.stringify on every tick; compare lengths first then stringify.
function snapshotHash(nodes: Node[], edges: Edge[]): string {
  // Using a fast-path: only hash positions + edge count + node count + data statuses
  let h = `n${nodes.length}e${edges.length}`;
  for (const n of nodes) {
    h += `|${n.id}:${Math.round(n.position.x)},${Math.round(n.position.y)}`;
    const d = n.data as Record<string, unknown>;
    if (d.status) h += `:${d.status as string}`;
    if (d.output) h += `:${(d.output as string).length}`;
    if (d.label) h += `:${String(d.label)}`;
    if (d.model_route) h += `:${String(d.model_route)}`;
    if (d.config) h += `:${JSON.stringify(d.config)}`;
  }
  return h;
}

export function useWorkflowSync(): UseWorkflowSync {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Stable refs so intervals/callbacks can read latest vals without re-subscribe
  const cloudUpdatedAtRef   = useRef<string>(new Date().toISOString());
  const lastSavedHashRef    = useRef<string>('');
  const lastCloudHashRef    = useRef<string>('');
  const lastCloudTimeRef    = useRef<number>(0);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const cloudTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core save functions ───────────────────────────────────────────────────
  const saveToLocal = useCallback(async (
    workflowId: string, nodes: Node[], edges: Edge[]
  ) => {
    setSyncStatus('saving_local');
    const now = new Date().toISOString();
    const cache: LocalWorkflowCache = {
      workflow_id: workflowId,
      nodes,
      edges,
      dirty: true,
      local_updated_at: now,
      cloud_updated_at: cloudUpdatedAtRef.current,
    };
    await localforage.setItem(cacheKey(workflowId), cache);
  }, []);

  const saveToCloud = useCallback(async (
    workflowId: string, nodes: Node[], edges: Edge[]
  ) => {
    setSyncStatus('saving_cloud');
    try {
      const res = await authedFetch(`/api/workflow/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes_json: nodes, edges_json: edges }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const now = new Date().toISOString();
      cloudUpdatedAtRef.current = now;
      lastCloudTimeRef.current = Date.now();

      // Clear dirty flag in IndexedDB
      const cached = await localforage.getItem<LocalWorkflowCache>(cacheKey(workflowId));
      if (cached) {
        await localforage.setItem(cacheKey(workflowId), {
          ...cached,
          dirty: false,
          cloud_updated_at: now,
        });
      }

      useWorkflowStore.getState().markClean();
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
      toast.success('工作流已保存', {
        description: '刚刚已成功同步到云端',
        duration: 2200,
      });
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, []);

  // ── Periodic snapshot interval ────────────────────────────────────────────
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const { currentWorkflowId, nodes, edges } = useWorkflowStore.getState();
      if (!currentWorkflowId || nodes.length === 0) return;

      const hash = snapshotHash(nodes, edges);

      // No change since last save → skip
      if (hash === lastSavedHashRef.current) return;

      // ── Local save (immediate, every 2s if changed) ──
      lastSavedHashRef.current = hash;
      void saveToLocal(currentWorkflowId, nodes, edges);

      // ── Cloud save (throttled to 8s, not during execution) ──
      if (hash === lastCloudHashRef.current) return;
      const elapsed = Date.now() - lastCloudTimeRef.current;
      if (elapsed >= CLOUD_THROTTLE_MS) {
        lastCloudHashRef.current = hash;
        void saveToCloud(currentWorkflowId, nodes, edges);
      } else if (!cloudTimerRef.current) {
        // Schedule cloud save for remaining time
        const remaining = CLOUD_THROTTLE_MS - elapsed;
        cloudTimerRef.current = setTimeout(() => {
          cloudTimerRef.current = null;
          const latest = useWorkflowStore.getState();
          if (!latest.currentWorkflowId) return;
          const latestHash = snapshotHash(latest.nodes, latest.edges);
          if (latestHash !== lastCloudHashRef.current) {
            lastCloudHashRef.current = latestHash;
            void saveToCloud(latest.currentWorkflowId, latest.nodes, latest.edges);
          }
        }, remaining);
      }
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, [saveToLocal, saveToCloud]);

  // ── Flush on unmount / route change ───────────────────────────────────────
  useEffect(() => {
    return () => {
      const { currentWorkflowId, nodes, edges } = useWorkflowStore.getState();
      if (!currentWorkflowId || nodes.length === 0) return;

      const hash = snapshotHash(nodes, edges);
      if (hash === lastCloudHashRef.current) return; // Already synced

      // Save to IndexedDB (fire-and-forget)
      void localforage.setItem(cacheKey(currentWorkflowId), {
        workflow_id: currentWorkflowId,
        nodes,
        edges,
        dirty: true,
        local_updated_at: new Date().toISOString(),
        cloud_updated_at: cloudUpdatedAtRef.current,
      } satisfies LocalWorkflowCache);

      // Best-effort cloud save with keepalive (credentials required for session cookie)
      const payload = JSON.stringify({ nodes_json: nodes, edges_json: edges });
      if (payload.length < KEEPALIVE_MAX_BYTES) {
        void fetch(`/api/workflow/${currentWorkflowId}`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
      // If payload too large, IndexedDB has it — will sync on next visit
    };
  }, []);

  // ── Warn on page close with unsaved data ──────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const { currentWorkflowId, nodes, edges } = useWorkflowStore.getState();
      if (!currentWorkflowId) return;
      const hash = snapshotHash(nodes, edges);
      if (hash !== lastCloudHashRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // ── Online/offline ────────────────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      // When back online, invalidate cloud hash to force re-upload
      lastCloudHashRef.current = '';
    };
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Force save (manual trigger) ──────────────────────────────────────────
  const forceSave = useCallback(async () => {
    const { currentWorkflowId, nodes, edges } = useWorkflowStore.getState();
    if (!currentWorkflowId) return;

    await saveToLocal(currentWorkflowId, nodes, edges);
    lastCloudHashRef.current = '';  // Force cloud refresh
    await saveToCloud(currentWorkflowId, nodes, edges);
  }, [saveToLocal, saveToCloud]);

  return { syncStatus, lastSyncedAt, forceSave };
}
