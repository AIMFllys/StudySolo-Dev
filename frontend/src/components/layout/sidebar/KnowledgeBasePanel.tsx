'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search, Filter, Brain, HelpCircle, Download, Layers,
  FileText, Database, Loader2, RefreshCw,
} from 'lucide-react';
import { authedFetch } from '@/services/api-client';

// ─── Types ──────────────────────────────────────────────────────────────────

type ContentTab = 'all' | 'mindmap' | 'flashcard' | 'quiz' | 'export';

interface KnowledgeItem {
  id: string;
  type: 'flashcard' | 'quiz_gen' | 'mind_map' | 'export_file';
  name: string;
  output_preview: string;
  source_workflow_id: string;
  source_workflow_name: string;
  updated_at: string;
}

const TAB_TO_API_TYPE: Record<ContentTab, string | undefined> = {
  all: undefined,
  mindmap: 'mind_map',
  flashcard: 'flashcard',
  quiz: 'quiz_gen',
  export: 'export_file',
};

// ─── Utilities ──────────────────────────────────────────────────────────────

function getTypeIcon(type: KnowledgeItem['type']) {
  switch (type) {
    case 'mind_map':    return <Brain className="h-3.5 w-3.5 text-violet-500 stroke-[1.5]" />;
    case 'flashcard':   return <Layers className="h-3.5 w-3.5 text-emerald-500 stroke-[1.5]" />;
    case 'quiz_gen':    return <HelpCircle className="h-3.5 w-3.5 text-amber-500 stroke-[1.5]" />;
    case 'export_file': return <Download className="h-3.5 w-3.5 text-blue-500 stroke-[1.5]" />;
  }
}

function getTypeLabel(type: KnowledgeItem['type']) {
  switch (type) {
    case 'mind_map':    return '思维导图';
    case 'flashcard':   return '闪卡';
    case 'quiz_gen':    return '测验';
    case 'export_file': return '导出文件';
  }
}

function getTypeBadgeStyle(type: KnowledgeItem['type']) {
  switch (type) {
    case 'mind_map':    return 'text-violet-600 bg-violet-50 border-violet-200/60 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-800/40';
    case 'flashcard':   return 'text-emerald-600 bg-emerald-50 border-emerald-200/60 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800/40';
    case 'quiz_gen':    return 'text-amber-600 bg-amber-50 border-amber-200/60 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800/40';
    case 'export_file': return 'text-blue-600 bg-blue-50 border-blue-200/60 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800/40';
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

const TABS: { value: ContentTab; label: string }[] = [
  { value: 'all',       label: '全部' },
  { value: 'mindmap',   label: '思维导图' },
  { value: 'flashcard', label: '闪卡' },
  { value: 'quiz',      label: '测验' },
  { value: 'export',    label: '导出' },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function KnowledgeBasePanel() {
  const [activeTab, setActiveTab] = useState<ContentTab>('all');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiType = TAB_TO_API_TYPE[activeTab];
      const qs = apiType ? `?item_type=${apiType}` : '';
      const res = await authedFetch(`/api/knowledge/items${qs}`);
      if (!res.ok) throw new Error('加载知识库失败');
      const data = await res.json();
      setItems(data as KnowledgeItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  // Client-side search filter
  const filtered = search.trim()
    ? items.filter(item =>
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.source_workflow_name.toLowerCase().includes(search.toLowerCase()) ||
        item.output_preview.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* ── Search ─────────────────────────────────────────────────────── */}
      <div className="px-2 pt-2 pb-1">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索知识库内容..."
            className="w-full rounded-lg border border-border/60 bg-background pl-7 pr-8 py-1.5 text-[11px] outline-none focus:border-foreground/30 transition-colors"
          />
          <button
            type="button"
            onClick={() => void fetchItems()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
            title="刷新"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Tab Filter ─────────────────────────────────────────────────── */}
      <div className="px-2 pb-1">
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0 mr-0.5" />
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content List ───────────────────────────────────────────────── */}
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2 py-1 space-y-1.5">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <Loader2 className="h-5 w-5 text-muted-foreground/40 animate-spin" />
            <p className="text-[11px] text-muted-foreground">加载中...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Database className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-[11px] text-destructive">{error}</p>
            <button onClick={() => void fetchItems()} className="text-[10px] text-primary hover:underline">重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <Database className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground">
              {search ? '未找到匹配内容' : '暂无知识库内容'}
            </p>
            {!search && (
              <p className="text-[10px] text-muted-foreground/60 leading-snug max-w-[180px]">
                运行包含闪卡、测验、思维导图或导出文件节点的工作流后，内容将自动出现在此处
              </p>
            )}
          </div>
        ) : (
          filtered.map(item => (
            <button
              key={`${item.source_workflow_id}-${item.id}`}
              type="button"
              onClick={() => window.open(`/c/${item.source_workflow_id}`, '_blank', 'noopener')}
              className="node-paper-bg group flex w-full flex-col gap-1.5 rounded-xl border-[1.5px] border-border/50 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all p-2.5 text-left"
            >
              {/* Row 1: icon + name */}
              <div className="flex items-start justify-between gap-2 w-full">
                <div className="flex items-center gap-1.5 min-w-0">
                  {getTypeIcon(item.type)}
                  <span className="text-[11px] font-semibold font-serif text-foreground truncate">{item.name}</span>
                </div>
                <span className={`shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold border ${getTypeBadgeStyle(item.type)}`}>
                  {getTypeLabel(item.type)}
                </span>
              </div>

              {/* Row 2: preview */}
              {item.output_preview && (
                <p className="text-[9.5px] leading-snug text-muted-foreground line-clamp-2">
                  {item.output_preview}
                </p>
              )}

              {/* Row 3: source workflow + date */}
              <div className="flex items-center justify-between pt-1 border-t border-dashed border-border/40 text-[9px] text-muted-foreground font-mono">
                <div className="flex items-center gap-1 min-w-0">
                  <FileText className="h-2.5 w-2.5 shrink-0 stroke-[1.5]" />
                  <span className="truncate">{item.source_workflow_name}</span>
                </div>
                <span className="shrink-0 ml-2">{formatDate(item.updated_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* ── Footer hint ────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2 border-t border-dashed border-border/40">
        <p className="text-[9px] text-muted-foreground/60 text-center leading-snug">
          工作流执行后自动保存至知识库 · 接入「写入数据」节点可持久化到数据库
        </p>
      </div>
    </div>
  );
}
