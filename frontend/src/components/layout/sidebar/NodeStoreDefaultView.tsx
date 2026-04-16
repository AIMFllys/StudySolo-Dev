'use client';

import { useMemo, useState } from 'react';
import {
  BrainCircuit, ChevronDown, ChevronRight, ChevronsUpDown,
  Bot, FileTerminal, LayoutGrid, LibraryBig, Network, NotebookPen, Search, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNodeManifest } from '@/features/workflow/hooks/use-node-manifest';
import type { NodeManifestItem, NodeType } from '@/types';
import { NodeStoreItem } from './NodeStoreItem';
import { matchesNodeStoreQuery, resolveNodeStoreCopy } from './resolve-node-store-copy';
import {
  ALL_NODE_STORE_CATEGORY_ID,
  resolveNodeStoreGroupsForView,
  resolveSelectedNodeStoreCategory,
} from './resolve-node-store-groups';
import type { NodeStoreCategoryId, NodeStoreGroup, NodeStoreGroupId } from './resolve-node-store-groups';

type NodeManifestLookup = Partial<Record<NodeType, NodeManifestItem>>;

const NODE_STORE_GROUP_ICONS: Record<NodeStoreGroupId, LucideIcon> = {
  trigger: FileTerminal,
  ai: BrainCircuit,
  content: NotebookPen,
  data: LibraryBig,
  logic: Network,
  agent: Bot,
};

type NodeStoreTagCategory = NodeStoreGroup & { icon: LucideIcon };

function TagFilterBar({
  categories,
  selectedCategoryId,
  onSelect,
}: {
  categories: NodeStoreTagCategory[];
  selectedCategoryId: NodeStoreCategoryId;
  onSelect: (id: NodeStoreCategoryId) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const allTags: Array<{ id: NodeStoreCategoryId; label: string; icon: LucideIcon }> = [
    { id: ALL_NODE_STORE_CATEGORY_ID, label: '全部', icon: LayoutGrid },
    ...categories.map((c) => ({ id: c.id, label: c.label, icon: c.icon })),
  ];
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
              <span className="relative z-10 hidden sm:inline">{tag.id === ALL_NODE_STORE_CATEGORY_ID ? '全部' : tag.label.split(' ')[0]}</span>
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

function CategorySection({
  label,
  types,
  searchQuery,
  manifestByType,
}: {
  label: string;
  types: NodeType[];
  searchQuery: string;
  manifestByType: NodeManifestLookup;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const filtered = useMemo(() => {
    return types.filter((type) => matchesNodeStoreQuery(type, manifestByType[type], searchQuery));
  }, [manifestByType, searchQuery, types]);
  if (filtered.length === 0) return null;
  return (
    <div className="mb-1.5">
      <button type="button" onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 transition-colors hover:text-muted-foreground">
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {label}<span className="ml-auto text-[9px] text-muted-foreground/40">{filtered.length}</span>
      </button>
      {!collapsed && (
        <div className="mt-0.5 space-y-0">
          {filtered.map((type) => {
            const copy = resolveNodeStoreCopy(type, manifestByType[type]);
            return (
              <NodeStoreItem
                key={type}
                nodeType={type}
                title={copy.title}
                description={copy.description}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DefaultNodeStoreView() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeStoreCategoryId>(ALL_NODE_STORE_CATEGORY_ID);
  const { manifest, isLoading, error } = useNodeManifest();
  const { groups } = useMemo(
    () => resolveNodeStoreGroupsForView(manifest, isLoading, error),
    [error, isLoading, manifest],
  );
  const categories = useMemo<NodeStoreTagCategory[]>(
    () =>
      groups.map((group) => ({
        ...group,
        icon: NODE_STORE_GROUP_ICONS[group.id],
      })),
    [groups],
  );
  const resolvedSelectedCategory = useMemo(
    () => resolveSelectedNodeStoreCategory(selectedCategory, groups),
    [groups, selectedCategory],
  );
  const visibleCategories = useMemo(
    () =>
      resolvedSelectedCategory === ALL_NODE_STORE_CATEGORY_ID
        ? categories
        : categories.filter((c) => c.id === resolvedSelectedCategory),
    [categories, resolvedSelectedCategory],
  );
  const manifestByType = useMemo(
    () =>
      manifest.reduce<NodeManifestLookup>((lookup, item) => {
        lookup[item.type] = item;
        return lookup;
      }, {}),
    [manifest],
  );
  const totalFiltered = useMemo(() => {
    return visibleCategories.reduce((sum, c) => {
      return sum + c.types.filter((type) => matchesNodeStoreQuery(type, manifestByType[type], search)).length;
    }, 0);
  }, [manifestByType, search, visibleCategories]);

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
      <TagFilterBar
        categories={categories}
        selectedCategoryId={resolvedSelectedCategory}
        onSelect={setSelectedCategory}
      />
      <div className="shrink-0 px-3 py-1">
        <p className="text-[9px] text-muted-foreground/50">
          {search
            ? `找到 ${totalFiltered} 个节点`
            : resolvedSelectedCategory === ALL_NODE_STORE_CATEGORY_ID
              ? '拖拽到画布，或点击添加'
              : `已筛选：${categories.find((c) => c.id === resolvedSelectedCategory)?.label}`}
        </p>
      </div>
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2 pb-2">
        {visibleCategories.map((c) => (
          <CategorySection
            key={c.id}
            label={c.label}
            types={c.types}
            searchQuery={search}
            manifestByType={manifestByType}
          />
        ))}
        {totalFiltered === 0 && <p className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">没有匹配的节点</p>}
      </div>
    </div>
  );
}
