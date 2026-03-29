'use client';

import { useMemo, useState } from 'react';
import {
  BrainCircuit, ChevronDown, ChevronRight, ChevronsUpDown,
  FileTerminal, LayoutGrid, LibraryBig, Network, NotebookPen, Search, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NODE_TYPE_META } from '@/features/workflow/constants/workflow-meta';
import type { NodeType } from '@/types';
import { NodeStoreItem } from './NodeStoreItem';

const NODE_CATEGORIES: { id: string; label: string; icon: LucideIcon; types: NodeType[] }[] = [
  { id: 'trigger', label: '输入源', icon: FileTerminal, types: ['trigger_input', 'knowledge_base', 'web_search'] },
  { id: 'ai', label: 'AI 处理', icon: BrainCircuit, types: ['ai_analyzer', 'ai_planner', 'content_extract', 'merge_polish'] },
  { id: 'content', label: '内容生成', icon: NotebookPen, types: ['outline_gen', 'summary', 'flashcard', 'quiz_gen', 'mind_map', 'chat_response'] },
  { id: 'data', label: '输出 & 存储', icon: LibraryBig, types: ['write_db', 'export_file'] },
  { id: 'logic', label: '逻辑控制', icon: Network, types: ['compare', 'logic_switch', 'loop_map', 'loop_group'] },
];

const ALL_TAG = 'all';

function TagFilterBar({ selectedCategoryId, onSelect }: { selectedCategoryId: string; onSelect: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const allTags = [{ id: ALL_TAG, label: '全部', icon: LayoutGrid }, ...NODE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))];
  const visibleTags = expanded ? allTags : allTags.slice(0, 3);
  return (
    <div className="shrink-0 border-b border-border px-2 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {visibleTags.map((tag) => {
          const isActive = selectedCategoryId === tag.id;
          return (
            <button key={tag.id} type="button" onClick={() => onSelect(tag.id)}
              className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors ${isActive ? 'node-paper-bg border-primary/30 text-primary shadow-sm' : 'border-border/50 bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              <div className="tag-paper-texture pointer-events-none absolute inset-0 z-0 opacity-60" />
              <tag.icon className={`relative z-10 h-[14px] w-[14px] ${isActive ? 'text-primary' : 'text-slate-500'}`} />
              <span className="relative z-10 hidden sm:inline">{tag.id === ALL_TAG ? '全部' : tag.label.split(' ')[0]}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setExpanded((p) => !p)}
          className="ml-auto flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ChevronsUpDown className="h-3 w-3" /><span>{expanded ? '收起' : '展开'}</span>
        </button>
      </div>
    </div>
  );
}

function CategorySection({ label, types, searchQuery }: { label: string; types: NodeType[]; searchQuery: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const filtered = useMemo(() => {
    if (!searchQuery) return types;
    const q = searchQuery.toLowerCase();
    return types.filter((t) => {
      const m = NODE_TYPE_META[t];
      return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || t.toLowerCase().includes(q);
    });
  }, [searchQuery, types]);
  if (filtered.length === 0) return null;
  return (
    <div className="mb-1.5">
      <button type="button" onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 transition-colors hover:text-muted-foreground">
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {label}<span className="ml-auto text-[9px] text-muted-foreground/40">{filtered.length}</span>
      </button>
      {!collapsed && <div className="mt-0.5 space-y-0">{filtered.map((t) => <NodeStoreItem key={t} nodeType={t} />)}</div>}
    </div>
  );
}

export default function DefaultNodeStoreView() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_TAG);
  const visibleCategories = useMemo(() => selectedCategory === ALL_TAG ? NODE_CATEGORIES : NODE_CATEGORIES.filter((c) => c.id === selectedCategory), [selectedCategory]);
  const totalFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return visibleCategories.reduce((sum, c) => {
      if (!search) return sum + c.types.length;
      return sum + c.types.filter((t) => { const m = NODE_TYPE_META[t]; return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || t.toLowerCase().includes(q); }).length;
    }, 0);
  }, [search, visibleCategories]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-2 pb-1.5 pt-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索节点..."
            className="w-full rounded-lg border border-border/50 bg-white/3 py-1.5 pl-7 pr-7 text-[11px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/20" />
          {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"><X className="h-3 w-3" /></button>}
        </div>
      </div>
      <TagFilterBar selectedCategoryId={selectedCategory} onSelect={setSelectedCategory} />
      <div className="shrink-0 px-3 py-1">
        <p className="text-[9px] text-muted-foreground/50">
          {search ? `找到 ${totalFiltered} 个节点` : selectedCategory === ALL_TAG ? '拖拽到画布，或点击添加' : `已筛选：${NODE_CATEGORIES.find((c) => c.id === selectedCategory)?.label}`}
        </p>
      </div>
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2 pb-2">
        {visibleCategories.map((c) => <CategorySection key={c.id} label={c.label} types={c.types} searchQuery={search} />)}
        {totalFiltered === 0 && <p className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">没有匹配的节点</p>}
      </div>
    </div>
  );
}
