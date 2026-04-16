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
 *
 * ── Agent 节点 (5) ──
 * agent_code_review   — 代码审查 Agent
 * agent_deep_research — 深度研究 Agent
 * agent_news          — 新闻追踪 Agent
 * agent_study_tutor   — 学习辅导 Agent
 * agent_visual_site   — 可视化站点 Agent
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
  | 'compare'
  | 'mind_map'
  | 'quiz_gen'
  | 'merge_polish'
  | 'knowledge_base'
  | 'web_search'
  | 'export_file'
  | 'logic_switch'
  | 'loop_map'
  | 'loop_group'
  | 'community_node'
  | 'agent_code_review'
  | 'agent_deep_research'
  | 'agent_news'
  | 'agent_study_tutor'
  | 'agent_visual_site';

/** 节点生命周期状态 */
export type NodeStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'done'
  | 'error'
  | 'skipped'
  | 'paused';

export interface NodeConfigFieldSchemaOption {
  label: string;
  value: string;
}

export interface NodeConfigFieldSchema {
  key: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'boolean' | 'multi_select';
  label: string;
  default?: string | number | boolean | string[];
  description?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: NodeConfigFieldSchemaOption[];
  /** If true, options should be fetched dynamically from the API */
  dynamic_options?: boolean;
}

export type NodeModelSource = 'none' | 'catalog' | 'agent';

export interface NodeManifestItem {
  type: NodeType;
  category: string;
  display_name: string;
  description: string;
  is_llm_node: boolean;
  output_format: string;
  icon: string;
  color: string;
  config_schema: NodeConfigFieldSchema[];
  output_capabilities: string[];
  supports_upload: boolean;
  supports_preview: boolean;
  deprecated_surface?: string | null;
  renderer: string | null;
  version: string;
  changelog: Record<string, string> | null;
  model_source: NodeModelSource;
  agent_name?: string | null;
}

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
  input_snapshot?: string;
  execution_time_ms?: number;
  config?: Record<string, unknown>;
  community_node_id?: string;
  community_icon?: string;
  input_hint?: string;
  model_preference?: string;
  /** trigger_input 节点的用户内联输入内容（工作流入口的学习目标文本） */
  user_content?: string;
}

/** 循环容器块节点数据 */
export interface LoopGroupNodeData {
  label: string;
  maxIterations: number;     // 1-100
  intervalSeconds: number;   // ≥ 0.1s
  description?: string;
  status?: NodeStatus;
  currentIteration?: number;
  totalIterations?: number;
}

export type WorkflowNodeData = AIStepNodeData | LoopGroupNodeData;

/** 工作流节点（存储在 nodes_json JSONB 中） */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
  parentId?: string;    // 如果在循环容器内，指向容器 ID
  extent?: 'parent';    // 限制拖拽不出容器
}
