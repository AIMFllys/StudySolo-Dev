'use client';

import { useState } from 'react';
import { CommunityNodeList } from '@/features/community-nodes/components/CommunityNodeList';
import DefaultNodeStoreView from './NodeStoreDefaultView';

export default function NodeStorePanel() {
  const [view, setView] = useState<'default' | 'community'>('default');

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-dashed border-border/50 px-3 py-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80 font-serif">
          节点商店
        </span>
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            <button type="button" onClick={() => setView('default')}
              className={`rounded-md px-2.5 py-1 text-[10px] transition-colors ${view === 'default' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              默认
            </button>
            <button type="button" onClick={() => setView('community')}
              className={`rounded-md px-2.5 py-1 text-[10px] transition-colors ${view === 'community' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              共享
            </button>
          </div>
        </div>
      </div>
      {view === 'default' ? <DefaultNodeStoreView /> : <CommunityNodeList />}
    </div>
  );
}
