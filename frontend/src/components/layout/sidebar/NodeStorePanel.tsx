'use client';

import { useCallback, useMemo, useState, useRef } from 'react';
import { GripVertical, Search, ChevronDown, ChevronRight, X, ChevronsUpDown, Zap, Bot, PenTool, Database, Shuffle, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NODE_TYPE_META } from '@/features/workflow/constants/workflow-meta';
import type { NodeType } from '@/types';
import { createPortal } from 'react-dom';

/** 节点分类 */
const NODE_CATEGORIES: { id: string; label: string; icon: LucideIcon; types: NodeType[] }[] = [
  {
    id: 'trigger',
    label: '输入 & 触发',
    icon: Zap,
    types: ['trigger_input'],
  },
  {
    id: 'ai',
    label: 'AI 处理',
    icon: Bot,
    types: ['ai_analyzer', 'ai_planner', 'content_extract', 'merge_polish'],
  },
  {
    id: 'content',
    label: '内容生成',
    icon: PenTool,
    types: ['outline_gen', 'summary', 'flashcard', 'quiz_gen', 'mind_map', 'chat_response'],
  },
  {
    id: 'data',
    label: '数据 & 集成',
    icon: Database,
    types: ['knowledge_base', 'web_search', 'write_db', 'export_file'],
  },
  {
    id: 'logic',
    label: '逻辑控制',
    icon: Shuffle,
    types: ['compare', 'logic_switch', 'loop_map'],
  },
];

const ALL_TAG = 'all';

/** Extended description for hover tooltip */
const NODE_EXTENDED_INFO: Partial<Record<NodeType, string>> = {
  trigger_input: '工作流的起始点。接收用户输入的学习目标、限制条件和上下文信息，作为后续节点的数据源。',
  ai_analyzer: '使用 AI 分析用户需求，提取关键学习目标、约束条件和上下文信息，为流程规划提供结构化数据。',
  ai_planner: '根据分析结果智能规划工作流路径，决定节点的拆分方式、连接关系与执行顺序。',
  outline_gen: '根据学习主题自动生成层次分明的知识大纲，包含章节划分和学习顺序建议。',
  content_extract: '从原始材料中智能提炼关键概念、核心案例和深度解释，去除冗余信息。',
  summary: '将多个内容源的信息整合归纳，生成结构化的学习重点和复习摘要。',
  flashcard: '将知识点转化为问答式闪卡，支持间隔重复记忆法，可导出至 Anki 等工具。',
  chat_response: '生成自然语言形式的学习建议、答复和引导，支持多轮对话式交互。',
  write_db: '将工作流处理结果持久化存储到数据库，并同步更新工作流运行记录。',
  compare: '对多个内容源进行多维度对比分析，识别异同点和互补关系。',
  mind_map: '将复杂知识体系转化为可视化思维导图，展示概念间的层级和关联关系。',
  quiz_gen: '基于学习内容自动生成多种题型的测验题目，附带详细解析和评分标准。',
  merge_polish: '整合来自多个节点的输出内容，进行统一风格润色和质量优化。',
  knowledge_base: '从已建立的知识库中检索与当前学习主题相关的内容，支持语义搜索。',
  web_search: '在互联网上搜索最新、最相关的学习资料，并智能整合到工作流中。',
  export_file: '将工作流的最终结果导出为 Markdown、PDF 等多种文件格式。',
  logic_switch: '基于条件表达式动态路由工作流，实现分支逻辑和条件判断。',
  loop_map: '对列表数据进行循环处理，每个元素独立经过指定的节点链。',
};

/* ─── Node Tooltip (portal) ─── */
function NodeTooltip({
  nodeType,
  anchorRect,
}: {
  nodeType: NodeType;
  anchorRect: DOMRect;
}) {
  const meta = NODE_TYPE_META[nodeType];
  const extended = NODE_EXTENDED_INFO[nodeType];

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.top,
    left: anchorRect.right + 8,
    zIndex: 9999,
    maxWidth: 260,
  };

  return createPortal(
    <div
      style={style}
      className="animate-in fade-in slide-in-from-left-1 duration-150 rounded-xl border border-border bg-background/98 p-3 shadow-lg backdrop-blur-sm"
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ${meta.accentClassName}`}
        >
          <meta.icon className="h-3.5 w-3.5 text-stone-900" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">{meta.label}</p>
          <p className="text-[10px] text-muted-foreground">{meta.description}</p>
        </div>
      </div>
      {extended ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{extended}</p>
      ) : null}
      <p className="mt-2 text-[9px] text-muted-foreground/50">拖拽到画布 或 点击添加</p>
    </div>,
    document.body
  );
}

/* ─── Tag filter bar ─── */
interface TagFilterBarProps {
  selectedCategoryId: string;
  onSelect: (id: string) => void;
}

function TagFilterBar({ selectedCategoryId, onSelect }: TagFilterBarProps) {
  const [expanded, setExpanded] = useState(false);

  const allTags = [
    { id: ALL_TAG, label: '全部', icon: LayoutGrid },
    ...NODE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, icon: c.icon })),
  ];

  // Collapsed: show only first row (All tag + up to 2 categories), plus expand button
  const VISIBLE_COUNT = 3; // "全部" + first 2 categories
  const visibleTags = expanded ? allTags : allTags.slice(0, VISIBLE_COUNT);

  return (
    <div className="shrink-0 border-b border-border px-2 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {visibleTags.map((tag) => {
          const isActive = selectedCategoryId === tag.id;
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => onSelect(tag.id)}
              className={`relative overflow-hidden inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-muted/60 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="tag-paper-texture absolute inset-0 z-0 pointer-events-none opacity-60" />
              <tag.icon className={`relative z-10 w-[14px] h-[14px] ${isActive ? 'text-primary-foreground' : 'text-slate-500'}`} />
              <span className="relative z-10 hidden sm:inline">{tag.id === ALL_TAG ? '全部' : tag.label.split(' ')[0]}</span>
            </button>
          );
        })}

        {/* Expand / collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? '收起筛选器' : '展开全部筛选器'}
          className="ml-auto flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronsUpDown className="h-3 w-3" />
          <span>{expanded ? '收起' : '展开'}</span>
        </button>
      </div>
    </div>
  );
}

/* ─── Single node item ─── */
function NodeStoreItem({ nodeType }: { nodeType: NodeType }) {
  const meta = NODE_TYPE_META[nodeType];
  const [hovered, setHovered] = useState(false);
  const itemRef = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData('application/studysolo-node-type', nodeType);
      e.dataTransfer.effectAllowed = 'move';
    },
    [nodeType]
  );

  const handleClick = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent('node-store:add-node', { detail: { nodeType } })
    );
  }, [nodeType]);

  const handlePointerEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setHovered(true), 400);
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHovered(false);
  }, []);

  const anchorRect = itemRef.current?.getBoundingClientRect();

  return (
    <>
      <button
        ref={itemRef}
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 active:scale-[0.98]"
      >
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1 ${meta.accentClassName}`}
        >
          <meta.icon className="h-3 w-3 text-stone-900" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-foreground">{meta.label}</p>
          <p className="truncate text-[9px] text-muted-foreground">{meta.description}</p>
        </div>
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {hovered && anchorRect ? <NodeTooltip nodeType={nodeType} anchorRect={anchorRect} /> : null}
    </>
  );
}

/* ─── Collapsible category section ─── */
function CategorySection({
  id,
  label,
  types,
  searchQuery,
}: {
  id: string;
  label: string;
  types: NodeType[];
  searchQuery: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const filtered = useMemo(() => {
    if (!searchQuery) return types;
    const q = searchQuery.toLowerCase();
    return types.filter((t) => {
      const m = NODE_TYPE_META[t];
      return (
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        t.toLowerCase().includes(q)
      );
    });
  }, [types, searchQuery]);

  if (filtered.length === 0) return null;

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70 transition-colors hover:text-muted-foreground"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {label}
        <span className="ml-auto text-[9px] text-muted-foreground/40">{filtered.length}</span>
      </button>
      {!collapsed && (
        <div className="mt-0.5 space-y-0">
          {filtered.map((nodeType) => (
            <NodeStoreItem key={nodeType} nodeType={nodeType} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main panel ─── */
export default function NodeStorePanel() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_TAG);

  // Categories to display based on selected tag
  const visibleCategories = useMemo(() => {
    if (selectedCategory === ALL_TAG) return NODE_CATEGORIES;
    return NODE_CATEGORIES.filter((c) => c.id === selectedCategory);
  }, [selectedCategory]);

  const totalFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return visibleCategories.reduce((sum, cat) => {
      if (!search) return sum + cat.types.length;
      return sum + cat.types.filter((t) => {
        const m = NODE_TYPE_META[t];
        return m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || t.toLowerCase().includes(q);
      }).length;
    }, 0);
  }, [search, visibleCategories]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Search bar */}
      <div className="shrink-0 px-2 pt-2 pb-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索节点..."
            className="w-full rounded-lg border border-border/50 bg-white/3 py-1.5 pl-7 pr-7 text-[11px] text-foreground placeholder-muted-foreground/60 outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tag filter bar */}
      <TagFilterBar
        selectedCategoryId={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Result hint */}
      <div className="shrink-0 px-3 py-1">
        <p className="text-[9px] text-muted-foreground/50">
          {search
            ? `找到 ${totalFiltered} 个节点`
            : selectedCategory === ALL_TAG
            ? '拖拽到画布，或点击添加'
            : `已筛选：${NODE_CATEGORIES.find((c) => c.id === selectedCategory)?.label}`}
        </p>
      </div>

      {/* Node list */}
      <div className="scrollbar-hide flex-1 overflow-y-auto px-2 pb-2">
        {visibleCategories.map((cat) => (
          <CategorySection
            key={cat.id}
            id={cat.id}
            label={cat.label}
            types={cat.types}
            searchQuery={search}
          />
        ))}
        {totalFiltered === 0 && (
          <p className="px-2 py-6 text-center text-[11px] text-muted-foreground/60">
            没有匹配的节点
          </p>
        )}
      </div>
    </div>
  );
}
