import type { EdgeTypes, NodeTypes } from '@xyflow/react';

import AnimatedEdge from '@/features/workflow/components/canvas/edges/AnimatedEdge';
import SequentialEdge from '@/features/workflow/components/canvas/edges/SequentialEdge';
import AIStepNode from '@/features/workflow/components/nodes/AIStepNode';
import TriggerInputNode from '@/features/workflow/components/nodes/TriggerInputNode';
import LogicSwitchNode from '@/features/workflow/components/nodes/LogicSwitchNode';
import GeneratingNode from '@/features/workflow/components/nodes/GeneratingNode';
import AnnotationNode from '@/features/workflow/components/nodes/AnnotationNode';
import LoopGroupNode from '@/features/workflow/components/nodes/LoopGroupNode';

export const BG_PRESETS = [
  { key: 'grid', className: 'bg-background bg-grid-pattern-canvas', label: '网格' },
  { key: 'paper', className: 'bg-[#faf9f6] dark:bg-[#1a1b1e]', label: '暖纸' },
  { key: 'slate', className: 'bg-slate-100 dark:bg-slate-900', label: '石板' },
  { key: 'clean', className: 'bg-white dark:bg-black', label: '纯净' },
] as const;

export const nodeTypes: NodeTypes = {
  trigger_input: TriggerInputNode,
  ai_analyzer: AIStepNode,
  ai_planner: AIStepNode,
  outline_gen: AIStepNode,
  content_extract: AIStepNode,
  summary: AIStepNode,
  flashcard: AIStepNode,
  chat_response: AIStepNode,
  write_db: AIStepNode,
  compare: AIStepNode,
  mind_map: AIStepNode,
  quiz_gen: AIStepNode,
  merge_polish: AIStepNode,
  knowledge_base: AIStepNode,
  web_search: AIStepNode,
  export_file: AIStepNode,
  logic_switch: LogicSwitchNode,
  loop_map: AIStepNode,
  agent_code_review: AIStepNode,
  agent_deep_research: AIStepNode,
  agent_news: AIStepNode,
  agent_study_tutor: AIStepNode,
  agent_visual_site: AIStepNode,
  generating: GeneratingNode,
  annotation: AnnotationNode,
  loop_group: LoopGroupNode,
  community_node: AIStepNode,
  // Fallbacks — any unknown type an AI may emit falls through to an AI-step card
  // instead of React Flow's default "text block" default node.
  default: AIStepNode,
  ai_step: AIStepNode,
  text: AnnotationNode,
  note: AnnotationNode,
  markdown: AnnotationNode,
};

export const edgeTypes: EdgeTypes = {
  default: AnimatedEdge,
  sequential: SequentialEdge,
};
