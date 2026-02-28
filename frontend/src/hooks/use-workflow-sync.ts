'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import localforage from 'localforage';
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

const LOCAL_DEBOUNCE_MS = 500;
const CLOUD_DEBOUNCE_MS = 4000;

function cacheKey(id: string) {
  return `workflow_cache_${id}`;
}

export function useWorkflowSync(): UseWorkflowSync {
  const { nodes, edges, currentWorkflowId, isDirty, markClean } = useWorkflowStore();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const localTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudUpdatedAtRef = useRef<string>(new Date().toISOString());

  // ── Crash recovery detection on mount ──────────────────────────────────
  useEffect(() => {
    if (!currentWorkflowId) return;

    (async () => {
      const cached = await localforage.getItem<LocalWorkflowCache>(
        cacheKey(currentWorkflowId)
      );
      if (!cached) return;

      const localTs = new Date(cached.local_updated_at).getTime();
      const cloudTs = new Date(cached.cloud_updated_at).getTime();

      if (cached.dirty && localTs > cloudTs) {
        // Conflict detected — dispatch a custom event for UI to handle
        window.dispatchEvent(
          new CustomEvent('workflow:crash-recovery', {
            detail: {
              workflowId: currentWorkflowId,
              localNodes: cached.nodes,
              localEdges: cached.edges,
              local_updated_at: cached.local_updated_at,
              cloud_updated_at: cached.cloud_updated_at,
            },
          })
        );
      }
    })();
  }, [currentWorkflowId]);

  // ── Save to IndexedDB (500ms debounce) ─────────────────────────────────
  const saveLocal = useCallback(async () => {
    if (!currentWorkflowId) return;
    setSyncStatus('saving_local');

    const now = new Date().toISOString();
    const cache: LocalWorkflowCache = {
      workflow_id: currentWorkflowId,
      nodes,
      edges,
      dirty: true,
      local_updated_at: now,
      cloud_updated_at: cloudUpdatedAtRef.current,
    };

    await localforage.setItem(cacheKey(currentWorkflowId), cache);
  }, [currentWorkflowId, nodes, edges]);

  // ── Save to cloud (3-5s debounce) ──────────────────────────────────────
  const saveCloud = useCallback(async () => {
    if (!currentWorkflowId) return;
    setSyncStatus('saving_cloud');

    try {
      const res = await fetch(`/api/workflow/${currentWorkflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes_json: nodes, edges_json: edges }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const now = new Date().toISOString();
      cloudUpdatedAtRef.current = now;

      // Clear dirty flag in IndexedDB
      const cached = await localforage.getItem<LocalWorkflowCache>(
        cacheKey(currentWorkflowId)
      );
      if (cached) {
        await localforage.setItem(cacheKey(currentWorkflowId), {
          ...cached,
          dirty: false,
          cloud_updated_at: now,
        });
      }

      markClean();
      setSyncStatus('synced');
      setLastSyncedAt(new Date());
    } catch {
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }
  }, [currentWorkflowId, nodes, edges, markClean]);

  // ── Trigger debounced saves when isDirty changes ────────────────────────
  useEffect(() => {
    if (!isDirty || !currentWorkflowId) return;

    // Local: 500ms debounce
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    localTimerRef.current = setTimeout(saveLocal, LOCAL_DEBOUNCE_MS);

    // Cloud: 4s debounce
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    cloudTimerRef.current = setTimeout(saveCloud, CLOUD_DEBOUNCE_MS);

    return () => {
      if (localTimerRef.current) clearTimeout(localTimerRef.current);
      if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    };
  }, [isDirty, currentWorkflowId, nodes, edges, saveLocal, saveCloud]);

  // ── Warn on page close with unsaved data ───────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Online/offline status ───────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => {
      if (isDirty) saveCloud();
    };
    const handleOffline = () => setSyncStatus('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isDirty, saveCloud]);

  const forceSave = useCallback(async () => {
    if (localTimerRef.current) clearTimeout(localTimerRef.current);
    if (cloudTimerRef.current) clearTimeout(cloudTimerRef.current);
    await saveLocal();
    await saveCloud();
  }, [saveLocal, saveCloud]);

  return { syncStatus, lastSyncedAt, forceSave };
}
