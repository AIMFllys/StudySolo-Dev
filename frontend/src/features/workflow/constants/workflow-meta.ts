import type { Node } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import {
  Play,
  BrainCircuit,
  GitMerge,
  ListTodo,
  ScanText,
  NotebookPen,
  StickyNote,
  MessageSquareQuote,
  Save,
  GitCompare,
  Network,
  FileQuestion,
  WandSparkles,
  LibraryBig,
  Globe,
  FileDown,
  Split,
  Repeat,
  FolderTree,
} from 'lucide-react';
import type { AIStepNodeData, NodeStatus, NodeType } from '@/types';

type StatusMeta = {
  badgeClassName: string;
  dotClassName: string;
  label: string;
};

export type NodePortSpec = {
  key: string;
  description: string;
  required: boolean;
};

type NodeTypeMeta = {
  accentClassName: string;
  description: string;
  icon: LucideIcon;
  label: string;
  inputs: NodePortSpec[];
  outputs: NodePortSpec[];
  /**
   * Whether this node type requires an AI language model to execute.
   * Controls whether NodeModelSelector is shown in the node header.
   * - true:  AI generation nodes (chat, analysis, generation, assessment)
   * - false: Tool/IO/control-flow nodes (db write, search, logic, loop, trigger)
   */
  requiresModel: boolean;
};

type WorkflowNodeLike = Pick<Node, 'id' | 'type'> & {
  data?: Partial<AIStepNodeData>;
};

export const STATUS_META: Record<NodeStatus, StatusMeta> = {
  pending: {
    label: '待执行',
    badgeClassName: 'border border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-400 border-dashed bg-transparent',
    dotClassName: 'bg-slate-400',
  },
  running: {
    label: '执行中',
    badgeClassName: 'border border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-400 bg-transparent shadow-[1px_1px_0px_rgba(14,165,233,0.2)]',
    dotClassName: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)]',
  },
  waiting: {
    label: '等待中',
    badgeClassName: 'border border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 shadow-[1px_1px_0px_rgba(245,158,11,0.2)]',
    dotClassName: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  },
  done: {
    label: '已完成',
    badgeClassName: 'border border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-[1px_1px_0px_rgba(5,150,105,0.2)]',
    dotClassName: 'bg-emerald-500',
  },
  error: {
    label: '错误',
    badgeClassName: 'border border-rose-500 text-rose-600 dark:border-rose-400 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 shadow-[1px_1px_0px_rgba(225,29,72,0.2)]',
    dotClassName: 'bg-rose-500',
  },
  paused: {
    label: '已暂停',
    badgeClassName: 'border border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400 border-dotted bg-transparent',
    dotClassName: 'bg-amber-500',
  },
  skipped: {
    label: '已跳过',
    badgeClassName: 'border border-stone-400 text-stone-600 dark:border-stone-500 dark:text-stone-300 border-dashed bg-transparent',
    dotClassName: 'bg-stone-400',
  },
};

export const NODE_TYPE_META: Record<NodeType, NodeTypeMeta> = {
  trigger_input: {
    label: '输入触发',
    icon: Play,
    description: '接收用户目标与限制条件',
    accentClassName: 'from-cyan-500/20 to-sky-500/5 text-cyan-100 ring-cyan-400/30',
    requiresModel: false,
    inputs: [],
    outputs: [{ key: '任务目标', description: '触发工作流的源输入', required: true }],
  },
  ai_analyzer: {
    label: '需求分析',
    icon: BrainCircuit,
    description: '抽取学习目标、约束与上下文',
    accentClassName: 'from-violet-500/20 to-indigo-500/5 text-violet-100 ring-violet-400/30',
    requiresModel: true,
    inputs: [{ key: '原始输入', description: '供分析的上游源文本', required: true }],
    outputs: [{ key: '分析结果', description: '分解后的结构化上下文', required: true }],
  },
  ai_planner: {
    label: '流程规划',
    icon: GitMerge,
    description: '决定节点拆分、连接关系与执行顺序',
    accentClassName: 'from-fuchsia-500/20 to-violet-500/5 text-fuchsia-100 ring-fuchsia-400/30',
    requiresModel: true,
    inputs: [{ key: '需求分析', description: '上游的分析结果', required: true }],
    outputs: [{ key: '执行计划', description: '子任务拆分页拆分逻辑等', required: true }],
  },
  outline_gen: {
    label: '大纲生成',
    icon: ListTodo,
    description: '形成清晰的知识结构与章节顺序',
    accentClassName: 'from-indigo-500/20 to-blue-500/5 text-indigo-100 ring-indigo-400/30',
    requiresModel: true,
    inputs: [{ key: '知识点/资料', description: '作为大纲依据的素材', required: true }],
    outputs: [{ key: '大纲结构', description: '各章节的目录结构', required: true }],
  },
  content_extract: {
    label: '内容提炼',
    icon: ScanText,
    description: '提炼关键概念、案例与解释',
    accentClassName: 'from-emerald-500/20 to-green-500/5 text-emerald-100 ring-emerald-400/30',
    requiresModel: true,
    inputs: [{ key: '源文档', description: '待提炼的原文或知识片段', required: true }],
    outputs: [{ key: '提炼结果', description: '萃取的关键点与概念', required: true }],
  },
  summary: {
    label: '总结归纳',
    icon: NotebookPen,
    description: '整理重点、结论与复习摘要',
    accentClassName: 'from-amber-500/20 to-orange-500/5 text-amber-100 ring-amber-400/30',
    requiresModel: true,
    inputs: [{ key: '前置内容', description: '待总结的散乱上游输出', required: true }],
    outputs: [{ key: '总结文稿', description: '聚合浓缩的精炼文本', required: true }],
  },
  flashcard: {
    label: '闪卡生成',
    icon: StickyNote,
    description: '转成适合记忆练习的问答卡片',
    accentClassName: 'from-rose-500/20 to-pink-500/5 text-rose-100 ring-rose-400/30',
    requiresModel: true,
    inputs: [{ key: '知识片段', description: '作为卡片素材的原文本', required: true }],
    outputs: [{ key: 'Q&A闪卡', description: 'JSON格式的问答题库', required: true }],
  },
  chat_response: {
    label: '学习回复',
    icon: MessageSquareQuote,
    description: '输出最终建议、答复与引导',
    accentClassName: 'from-sky-500/20 to-cyan-500/5 text-sky-100 ring-sky-400/30',
    requiresModel: true,
    inputs: [{ key: '对话上下文', description: '用户提问及处理结果', required: true }],
    outputs: [{ key: '系统回复', description: '发给用户的终态消息', required: true }],
  },
  write_db: {
    label: '写入数据',
    icon: Save,
    description: '持久化结果并同步到工作流记录',
    accentClassName: 'from-slate-500/20 to-zinc-500/5 text-slate-100 ring-slate-400/30',
    requiresModel: false,
    inputs: [{ key: '需保存数据', description: '要归档的数据JSON/文本', required: true }],
    outputs: [{ key: '保存状态', description: '持久化结果返回', required: true }],
  },
  compare: {
    label: '对比分析',
    icon: GitCompare,
    description: '多维度内容对比分析',
    accentClassName: 'from-teal-500/20 to-emerald-500/5 text-teal-100 ring-teal-400/30',
    requiresModel: true,
    inputs: [{ key: '比对源', description: '来自多输入的对照物', required: true }],
    outputs: [{ key: '对比报告', description: '包含差异性/相似度的分析', required: true }],
  },
  mind_map: {
    label: '思维导图',
    icon: Network,
    description: '生成结构化思维导图',
    accentClassName: 'from-lime-500/20 to-green-500/5 text-lime-100 ring-lime-400/30',
    requiresModel: true,
    inputs: [{ key: '发散知识点', description: '散乱排列的概念簇', required: true }],
    outputs: [{ key: '导图Markdown', description: '树状描述的层级文本', required: true }],
  },
  quiz_gen: {
    label: '测验生成',
    icon: FileQuestion,
    description: '生成测验题目与解析',
    accentClassName: 'from-yellow-500/20 to-amber-500/5 text-yellow-100 ring-yellow-400/30',
    requiresModel: true,
    inputs: [{ key: '考点范围', description: '需出题的相关文本', required: true }],
    outputs: [{ key: '题库列表', description: '试卷JSON包含题干/选项/解析', required: true }],
  },
  merge_polish: {
    label: '合并润色',
    icon: WandSparkles,
    description: '整合与润色多源内容',
    accentClassName: 'from-pink-500/20 to-rose-500/5 text-pink-100 ring-pink-400/30',
    requiresModel: true,
    inputs: [{ key: '草稿簇', description: '散乱/风格不齐的源文本', required: true }],
    outputs: [{ key: '定稿', description: '经合并修饰的通顺终稿', required: true }],
  },
  knowledge_base: {
    label: '知识库检索',
    icon: LibraryBig,
    description: '从知识库检索相关内容',
    accentClassName: 'from-blue-500/20 to-indigo-500/5 text-blue-100 ring-blue-400/30',
    requiresModel: false,
    inputs: [{ key: '检索 Query', description: '用于计算相似度的查询串', required: true }],
    outputs: [{ key: '相关片段', description: '检索后按得分倒排的内容池', required: true }],
  },
  web_search: {
    label: '网络搜索',
    icon: Globe,
    description: '互联网内容搜索与整合',
    accentClassName: 'from-cyan-500/20 to-blue-500/5 text-cyan-100 ring-cyan-400/30',
    requiresModel: false,
    inputs: [{ key: '搜索词', description: '引擎查询关键字', required: true }],
    outputs: [{ key: '搜索结果', description: '聚合爬取的第三方网页内容', required: true }],
  },
  export_file: {
    label: '文件导出',
    icon: FileDown,
    description: '导出工作流结果为文件',
    accentClassName: 'from-gray-500/20 to-slate-500/5 text-gray-100 ring-gray-400/30',
    requiresModel: false,
    inputs: [{ key: '文件内容', description: '要转换成文件的文本/富文本', required: true }],
    outputs: [{ key: '文件访问链接', description: '提供用户下载的URL等标识', required: true }],
  },
  logic_switch: {
    label: '逻辑分支',
    icon: Split,
    description: '基于条件动态路由',
    accentClassName: 'from-orange-500/20 to-amber-500/5 text-orange-100 ring-orange-400/30',
    requiresModel: true,  // Uses LLM to evaluate branch conditions
    inputs: [{ key: '判断条件', description: '根据上游信息或全局选择的分流依据', required: true }],
    outputs: [{ key: '选择路向', description: '动态路由输出状态', required: true }],
  },
  loop_map: {
    label: '循环映射',
    icon: Repeat,
    description: '循环处理列表数据',
    accentClassName: 'from-red-500/20 to-orange-500/5 text-red-100 ring-red-400/30',
    requiresModel: true,  // Uses LLM to decompose items
    inputs: [{ key: '输入集合', description: '需要循环处理的列表/数组', required: true }],
    outputs: [{ key: '映射结果', description: '逐个迭代后的整合输出', required: true }],
  },
  loop_group: {
    label: '循环块',
    icon: FolderTree,
    description: '可缩放的循环容器',
    accentClassName: 'from-emerald-500/20 to-teal-500/5 text-emerald-100 ring-emerald-400/30',
    requiresModel: false,
    inputs: [{ key: '初始数据', description: '注入到该容器的种子数据', required: false }],
    outputs: [{ key: '累积结果', description: '循环结束后汇聚的总数据', required: false }],
  },
};

export function getStatusMeta(status?: string) {
  return STATUS_META[(status as NodeStatus) ?? 'pending'] ?? STATUS_META.pending;
}

export function getNodeTypeMeta(nodeType?: string) {
  return NODE_TYPE_META[(nodeType as NodeType) ?? 'chat_response'] ?? NODE_TYPE_META.chat_response;
}

export function getNodePreview(output?: string, fallback = '等待该步骤生成内容') {
  const normalized = (output ?? '')
    .replace(/```[\s\S]*?```/g, '代码块')
    .replace(/[#>*`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, 96);
}

export function getNodeTitle(node: WorkflowNodeLike) {
  return node.data?.label?.trim() || getNodeTypeMeta(node.data?.type ?? node.type).label;
}

export function getNodeTheme(nodeType: string) {
  // 1. RAW_DATA (数据源/输入) - 灰色打孔纸质感
  if (['trigger_input'].includes(nodeType)) {
    return {
      category: 'RAW_DATA',
      borderClass: 'border border-dashed border-slate-400 dark:border-slate-500',
      innerBorderClass: 'border-none',
      headerTextColor: 'text-slate-600 dark:text-slate-400',
    };
  }
  // 2. ANALYSIS (逻辑分析) - 墨绿双线审阅质感
  if (['ai_analyzer', 'content_extract', 'compare'].includes(nodeType)) {
    return {
      category: 'ANALYSIS',
      borderClass: 'border-2 border-emerald-800 dark:border-emerald-600',
      innerBorderClass: 'border-[0.5px] border-dashed border-emerald-800/60 dark:border-emerald-500/60',
      headerTextColor: 'text-emerald-800 dark:text-emerald-500',
    };
  }
  // 3. GENERATION (内容生成) - 靛蓝厚重书写质感
  if (['outline_gen', 'summary'].includes(nodeType)) {
    return {
      category: 'GENERATION',
      borderClass: 'border-[3px] border-indigo-900 dark:border-indigo-400',
      innerBorderClass: 'border-[0.5px] border-solid border-indigo-900/40 dark:border-indigo-400/40',
      headerTextColor: 'text-indigo-900 dark:text-indigo-400',
    };
  }
  // 4. FINAL_REPORT (正式报告/终稿) - 沉稳藏青带内嵌缝线
  if (['chat_response', 'merge_polish'].includes(nodeType)) {
    return {
      category: 'FINAL_REPORT',
      borderClass: 'border-[2px] border-slate-800 dark:border-slate-300 ring-4 ring-slate-800/5 dark:ring-slate-300/5',
      innerBorderClass: 'border-[1px] border-dashed border-slate-800/30 dark:border-slate-300/30 m-1',
      headerTextColor: 'text-slate-800 dark:text-slate-300',
    };
  }
  // 5. EXTERNAL_TOOL (外部检索) - 青色胶布贴边质感
  if (['knowledge_base', 'web_search'].includes(nodeType)) {
    return {
      category: 'EXTERNAL_TOOL',
      borderClass: 'border-l-4 border-y border-r border-cyan-700 dark:border-cyan-500',
      innerBorderClass: 'border-none',
      headerTextColor: 'text-cyan-800 dark:text-cyan-500',
    };
  }
  // 6. ACTION_IO (系统读写) - 工业灰点线排版
  if (['write_db', 'export_file'].includes(nodeType)) {
    return {
      category: 'ACTION_IO',
      borderClass: 'border-[1.5px] border-dotted border-zinc-500 dark:border-zinc-400',
      innerBorderClass: 'border-[0.5px] border-solid border-zinc-500/20 dark:border-zinc-400/20',
      headerTextColor: 'text-zinc-600 dark:text-zinc-400',
    };
  }
  // 7. CONTROL_FLOW (逻辑控制) - 琥珀色警告线质感
  if (nodeType === 'logic_switch') {
    return {
      category: 'CONTROL_FLOW_BRANCH',
      borderClass: 'border-[2.5px] border-amber-500 dark:border-amber-400 shadow-[0_0_0_2px_rgba(245,158,11,0.08)] bg-[linear-gradient(135deg,rgba(245,158,11,0.06),transparent_55%)]',
      innerBorderClass: 'border-[1px] border-dashed border-amber-500/55 dark:border-amber-400/50',
      headerTextColor: 'text-amber-700 dark:text-amber-300',
    };
  }
  if (['loop_map', 'loop_group'].includes(nodeType)) {
    return {
      category: 'CONTROL_FLOW',
      borderClass: 'border-2 border-amber-600 dark:border-amber-500',
      innerBorderClass: 'border-[0.5px] border-dashed border-amber-600/50 dark:border-amber-500/50',
      headerTextColor: 'text-amber-700 dark:text-amber-500',
    };
  }
  // 8. VISUALIZE (图表渲染) - 紫色相框质感
  if (['mind_map'].includes(nodeType)) {
    return {
      category: 'VISUALIZE',
      borderClass: 'border border-fuchsia-800 dark:border-fuchsia-500 shadow-[inset_0_0_0_2px_rgba(134,25,143,0.1)]',
      innerBorderClass: 'border-[0.5px] border-solid border-fuchsia-800/30 dark:border-fuchsia-500/30 m-2',
      headerTextColor: 'text-fuchsia-800 dark:text-fuchsia-400',
    };
  }
  // 9. ASSESSMENT (考核测试) - 玫瑰红考卷质感
  if (['quiz_gen', 'flashcard'].includes(nodeType)) {
    return {
      category: 'ASSESSMENT',
      borderClass: 'border-2 border-rose-800 dark:border-rose-400',
      innerBorderClass: 'border-t-[0.5px] border-b-[0.5px] border-solid border-rose-800/30 dark:border-rose-400/30 my-4',
      headerTextColor: 'text-rose-800 dark:text-rose-400',
    };
  }
  // 10. FEEDBACK (评估反馈) - 青绿色批改笔迹质感 (Fallback / 预留)
  return {
    category: 'FEEDBACK',
    borderClass: 'border-[1.5px] border-teal-700 dark:border-teal-500',
    innerBorderClass: 'border-[1px] border-dotted border-teal-700/40 dark:border-teal-500/40',
    headerTextColor: 'text-teal-800 dark:text-teal-400',
  };
}
