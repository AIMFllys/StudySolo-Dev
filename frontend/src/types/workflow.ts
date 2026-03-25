import type { Edge, Node } from '@xyflow/react';

/**
 * 工作流节点类型枚举
 *
 * ── 原始节点 (9) ──
 * trigger_input   — 用户输入触发
 * ai_analyzer     — 需求分析器
 * ai_planner      — 工作流规划器
 * outline_gen     — 大纲生成
 * content_extract — 知识提炼
 * summary         — 总结归纳
 * flashcard       — 闪卡生成
 * chat_response   — 回复用户
 * write_db        — 数据写入
 *
 * ── P1 新增节点 (7) ──
 * compare         — 对比分析
 * mind_map        — 思维导图
 * quiz_gen        — 测验生成
 * merge_polish    — 合并润色
 * knowledge_base  — 知识库检索
 * web_search      — 网络搜索
 * export_file     — 文件导出
 *
 * ── P2 引擎节点 (2) ──
 * logic_switch    — 逻辑分支（条件判断）
 * loop_map        — 循环映射（内部拆分）
 *
 * ── 结构节点 (1) ──
 * loop_group      — 循环容器块
 */
export type NodeType =
  | 'trigger_input'
  | 'ai_analyzer'
  | 'ai_planner'
  | 'outline_gen'
  | 'content_extract'
  | 'summary'
  | 'flashcard'
  | 'chat_response'
  | 'write_db'
  // ── P1 节点 ──
  | 'compare'
  | 'mind_map'
  | 'quiz_gen'
  | 'merge_polish'
  | 'knowledge_base'
  | 'web_search'
  | 'export_file'
  // ── P2 引擎节点 ──
  | 'logic_switch'
  | 'loop_map'
  // ── 结构节点 ──
  | 'loop_group';

/** 节点生命周期状态 */
export type NodeStatus = 'pending' | 'running' | 'done' | 'error' | 'paused';

/** AI 步骤节点数据（存储在 WorkflowNode.data 中） */
export interface AIStepNodeData {
  label: string;
  type?: NodeType;
  system_prompt: string;
  model_route: string;
  status: NodeStatus;
  output: string;
  error?: string;
  output_format?: string;
}

/** 循环容器块节点数据 */
export interface LoopGroupNodeData {
  label: string;
  maxIterations: number;     // 1-100
  intervalSeconds: number;   // ≥ 0.1s
  description?: string;
}

/** 工作流节点（存储在 nodes_json JSONB 中） */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: AIStepNodeData | LoopGroupNodeData;
  parentId?: string;    // 如果在循环容器内，指向容器 ID
  extent?: 'parent';    // 限制拖拽不出容器
}

/**
 * 连线类型 — 唯一：顺序线
 *
 * 条件分支和循环不是"线的类型"，而是"节点结构"：
 * - 条件分支 = logic_switch 节点 + 多条出边 + data.branch
 * - 循环 = LoopGroupNode 容器块
 */
export type EdgeType = 'sequential';

/** Handle 方位 ID (LEFT/TOP=target, RIGHT/BOTTOM=source) */
export type HandlePosition =
  | 'source-right'
  | 'source-bottom'
  | 'target-left'
  | 'target-top';

/** 连线附加数据 */
export interface WorkflowEdgeData {
  /** 备注文字（不参与执行） */
  note?: string;
  /** 等待时间-秒（0-300，执行目标节点前等待） */
  waitSeconds?: number;
  /** 条件分支名（仅 logic_switch 出边使用，后端 executor 读取） */
  branch?: string;
}

/** 工作流连线（存储在 edges_json JSONB 中） */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: HandlePosition;
  targetHandle?: HandlePosition;
  type?: EdgeType;
  data?: WorkflowEdgeData;
}

/** 兼容旧数据 — 为缺失字段补充默认值，旧类型统一迁移为 sequential */
export function normalizeEdge(edge: Partial<WorkflowEdge> & { id: string; source: string; target: string }): WorkflowEdge {
  return {
    ...edge,
    type: 'sequential',
    sourceHandle: edge.sourceHandle || 'source-right',
    targetHandle: edge.targetHandle || 'target-left',
    data: edge.data || {},
  };
}

export interface WorkflowMeta {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
  is_published?: boolean;
  likes_count?: number;
  tags?: string[];
}

export interface WorkflowContent {
  id: string;
  name: string;
  nodes_json: Node[];
  edges_json: Edge[];
}
