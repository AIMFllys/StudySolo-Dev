'use client';

import { useEffect, useState } from 'react';
import { FileText, Eye, Star, Heart, Search, Filter, AlertTriangle } from 'lucide-react';
import { fetchMarketplace } from '@/services/workflow.service';
import { usePanelStore } from '@/stores/ui/use-panel-store';
import type { WorkflowMeta } from '@/types/workflow';

type FilterType = 'all' | 'official' | 'featured' | 'public';

export default function WorkflowExamplesPanel() {
  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);

  const marketplaceVersion = usePanelStore((s) => s.marketplaceVersion);

  // Debounce search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setFetchError(null);
    });

    const params: Parameters<typeof fetchMarketplace>[0] = {};
    if (filter !== 'all') params.filter = filter;
    if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

    // P1 Fix: consume FetchResult<T> to distinguish empty vs error,
    //         and add .catch to prevent loading state from hanging forever.
    fetchMarketplace(params)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setWorkflows(result.data);
          setFetchError(null);
        } else {
          setWorkflows([]);
          setFetchError(result.error);
        }
        setLoading(false);
      })
      .catch(() => {
        // Safety net: if fetchMarketplace itself throws (should not happen
        // with current implementation, but guards future regressions).
        if (!cancelled) {
          setWorkflows([]);
          setFetchError('加载失败，请稍后重试');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [filter, debouncedSearch, marketplaceVersion]);



  const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'official', label: '官方' },
    { value: 'featured', label: '精选' },
    { value: 'public', label: '公开' },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search + Filter */}
      <div className="px-2 pt-2 pb-1 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索工作流..."
            className="w-full rounded-lg border border-border/60 bg-background pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-foreground/30 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <p className="text-center text-[10px] text-muted-foreground py-4">加载中...</p>
        ) : fetchError ? (
          /* P1 Fix: show distinct error state instead of empty-list message */
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-snug max-w-[160px]">
              {fetchError}
            </p>
          </div>
        ) : workflows.length === 0 ? (
          <p className="text-center text-[10px] text-muted-foreground py-4">暂无工作流</p>
        ) : (
          <div className="space-y-2">
            {workflows.map((wf) => (
              <button
                key={wf.id}
                type="button"
                onClick={() => window.open(`/s/${wf.id}`, '_blank', 'noopener')}
                className="node-paper-bg group flex w-full flex-col gap-1.5 rounded-xl border-[1.5px] border-border/50 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2 w-full">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-foreground stroke-[1.5]" />
                    <span className="text-xs font-semibold font-serif text-foreground">{wf.name}</span>
                  </div>
                  <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 stroke-[1.5]" />
                </div>
                {wf.description && (
                  <p className="text-[10.5px] leading-snug text-muted-foreground font-serif">{wf.description}</p>
                )}
                <div className="mt-1 pt-1.5 border-t border-dashed border-border/50 flex items-center justify-between w-full text-[10px] text-muted-foreground font-mono tracking-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[80px]">{wf.owner_name || '未知'}</span>
                    <span className="flex items-center gap-0.5">
                      <Heart className="h-2.5 w-2.5 stroke-[1.5]" />
                      {wf.likes_count}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 stroke-[1.5]" />
                      {wf.favorites_count}
                    </span>
                  </div>
                  {wf.tags.length > 0 && (
                    <span className="rounded-lg border-[1.5px] border-border/50 bg-muted/50 px-1.5 py-0.5 text-[9px] font-medium tracking-wider shadow-sm">
                      {wf.tags[0]}
                    </span>
                  )}
                </div>

              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
