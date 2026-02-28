// ============================================================
// StudySolo MVP — 公共类型定义
// ============================================================

/**
 * 工作流节点类型枚举
 *
 * trigger_input   — 用户输入触发
 * ai_analyzer     — 需求分析器
 * ai_planner      — 工作流规划器
 * outline_gen     — 大纲生成
 * content_extract — 知识提炼
 * summary         — 总结归纳
 * flashcard       — 闪卡生成
 * chat_response   — 回复用户
 * write_db        — 数据写入
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
  | 'write_db';

/** 节点生命周期状态 */
export type NodeStatus = 'pending' | 'running' | 'done' | 'error' | 'paused';

/** AI 步骤节点数据（存储在 WorkflowNode.data 中） */
export interface AIStepNodeData {
  label: string;
  type: NodeType;
  system_prompt: string;
  model_route: string;
  status: NodeStatus;
  output: string;
}

/** 工作流节点（存储在 nodes_json JSONB 中） */
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: AIStepNodeData;
}

/** 工作流连线（存储在 edges_json JSONB 中） */
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}
