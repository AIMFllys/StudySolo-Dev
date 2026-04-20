'use client';

import { createPortal } from 'react-dom';
import { useCallback, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { NODE_TYPE_META, getNodeTheme } from '@/features/workflow/constants/workflow-meta';
import { eventBus } from '@/lib/events/event-bus';
import type { NodeType } from '@/types';

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
  agent_code_review: '固定调用代码审查子后端，只能选择该 Agent 暴露的模型，用于补丁评估、问题定位和审查结论生成。',
  agent_deep_research: '固定调用深度研究子后端，只能选择该 Agent 暴露的模型，用于长链资料研究与深度综述。',
  agent_news: '固定调用新闻子后端，只能选择该 Agent 暴露的模型，用于最新新闻追踪、时间线整理和事件分析。',
  agent_study_tutor: '固定调用学习辅导子后端，只能选择该 Agent 暴露的模型，用于讲解答疑和学习方案建议。',
  agent_visual_site: '固定调用可视化站点子后端，只能选择该 Agent 暴露的模型，用于页面结构、区块方案和 HTML 草稿生成。',
};

interface NodeStoreItemProps {
  nodeType: NodeType;
  title: string;
  description: string;
}

function NodeTooltip({
  nodeType,
  title,
  description,
  anchorRect,
}: NodeStoreItemProps & { anchorRect: DOMRect }) {
  const meta = NODE_TYPE_META[nodeType];
  const extended = NODE_EXTENDED_INFO[nodeType];
  const nodeTheme = getNodeTheme(nodeType);
  return createPortal(
    <div style={{ position: 'fixed', top: anchorRect.top, left: anchorRect.right + 8, zIndex: 9999, maxWidth: 260 }}
      className="node-paper-bg animate-in fade-in slide-in-from-left-1 duration-150 rounded-xl border border-border p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-background shadow-sm ${nodeTheme.borderClass} ${nodeTheme.headerTextColor}`}>
          <div className={`absolute inset-0 pointer-events-none ${nodeTheme.innerBorderClass} m-[1px]`} />
          <meta.icon className="z-10 h-3.5 w-3.5 stroke-[2.5]" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
      </div>
      {extended && <p className="text-[11px] leading-relaxed text-muted-foreground">{extended}</p>}
      <p className="mt-2 text-[9px] text-muted-foreground/50">拖拽到画布 或 点击添加</p>
    </div>,
    document.body,
  );
}

export function NodeStoreItem({ nodeType, title, description }: NodeStoreItemProps) {
  const meta = NODE_TYPE_META[nodeType];
  const [hovered, setHovered] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodeTheme = getNodeTheme(nodeType);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/studysolo-node-type', nodeType);
    e.dataTransfer.effectAllowed = 'move';
  }, [nodeType]);

  const handleClick = useCallback(() => {
    eventBus.emit('node-store:add-node', { nodeType });
  }, [nodeType]);

  return (
    <>
      <button type="button" draggable onDragStart={handleDragStart} onClick={handleClick}
        onPointerEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAnchorRect(rect);
          hoverTimerRef.current = setTimeout(() => setHovered(true), 400);
        }}
        onPointerLeave={() => {
          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
          setHovered(false);
        }}
        className="group flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5 active:scale-[0.98]">
        <div className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-background shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-transform group-hover:scale-110 ${nodeTheme.borderClass} ${nodeTheme.headerTextColor}`}>
          <div className={`absolute inset-0 pointer-events-none ${nodeTheme.innerBorderClass} m-[1px]`} />
          <meta.icon className="z-10 h-3 w-3 stroke-[2.5]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-foreground">{title}</p>
          <p className="truncate text-[9px] text-muted-foreground">{description}</p>
        </div>
        <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      {hovered && anchorRect && (
        <NodeTooltip
          nodeType={nodeType}
          title={title}
          description={description}
          anchorRect={anchorRect}
        />
      )}
    </>
  );
}
