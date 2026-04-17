import type { SyncStatus } from './use-workflow-sync';

export function resolveCloudSyncFailureStatus(isOnline: boolean): SyncStatus {
  return isOnline ? 'error' : 'offline';
}

export function shouldAttemptCloudSave(hash: string, lastCloudHash: string): boolean {
  return hash !== lastCloudHash;
}

export function swallowKeepaliveFailure(promise: Promise<unknown>): void {
  void promise.catch(() => undefined);
}
