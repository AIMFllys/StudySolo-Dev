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
  FileSearch,
  Newspaper,
  GraduationCap,
  PanelsTopLeft,
  Code2,
} from 'lucide-react';
import type { NodeType } from '@/types';

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
    description: '导出为 MD/TXT/Word 或复制到剪贴板',
    accentClassName: 'from-gray-500/20 to-slate-500/5 text-gray-100 ring-gray-400/30',
    requiresModel: false,
    inputs: [{ key: '文件内容', description: '要转换成文件的文本/富文本', required: true }],
    outputs: [{ key: '文件/复制', description: '下载链接或可复制内容', required: true }],
  },
  logic_switch: {
    label: '逻辑分支',
    icon: Split,
    description: '基于条件动态路由',
    accentClassName: 'from-orange-500/20 to-amber-500/5 text-orange-100 ring-orange-400/30',
    requiresModel: true,
    inputs: [{ key: '判断条件', description: '根据上游信息或全局选择的分流依据', required: true }],
    outputs: [{ key: '选择路向', description: '动态路由输出状态', required: true }],
  },
  loop_map: {
    label: '循环映射',
    icon: Repeat,
    description: '循环处理列表数据',
    accentClassName: 'from-red-500/20 to-orange-500/5 text-red-100 ring-red-400/30',
    requiresModel: true,
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
  community_node: {
    label: '社区节点',
    icon: Globe,
    description: '社区共享的封装 AI 节点',
    accentClassName: 'from-teal-500/20 to-cyan-500/5 text-teal-100 ring-teal-400/30',
    requiresModel: true,
    inputs: [{ key: '上游输入', description: '社区节点所需的原始输入或上游内容', required: true }],
    outputs: [{ key: '节点输出', description: '社区节点生成的结果', required: true }],
  },
  agent_code_review: {
    label: '代码审查 Agent',
    icon: Code2,
    description: '固定调用子后端代码审查 Agent',
    accentClassName: 'from-emerald-500/20 to-teal-500/5 text-emerald-100 ring-emerald-400/30',
    requiresModel: true,
    inputs: [{ key: '代码/补丁', description: '待审查的代码、补丁或方案', required: true }],
    outputs: [{ key: '审查结论', description: '问题清单、风险判断与修复建议', required: true }],
  },
  agent_deep_research: {
    label: '深度研究 Agent',
    icon: FileSearch,
    description: '固定调用子后端深度研究 Agent',
    accentClassName: 'from-blue-500/20 to-cyan-500/5 text-blue-100 ring-blue-400/30',
    requiresModel: true,
    inputs: [{ key: '研究主题', description: '待研究的问题、资料或上游上下文', required: true }],
    outputs: [{ key: '研究综述', description: '结构化研究结果与结论', required: true }],
  },
  agent_news: {
    label: '新闻追踪 Agent',
    icon: Newspaper,
    description: '固定调用子后端新闻追踪 Agent',
    accentClassName: 'from-amber-500/20 to-orange-500/5 text-amber-100 ring-amber-400/30',
    requiresModel: true,
    inputs: [{ key: '新闻主题', description: '待追踪的事件、实体或问题', required: true }],
    outputs: [{ key: '新闻摘要', description: '时间线、进展与影响分析', required: true }],
  },
  agent_study_tutor: {
    label: '学习辅导 Agent',
    icon: GraduationCap,
    description: '固定调用子后端学习辅导 Agent',
    accentClassName: 'from-violet-500/20 to-fuchsia-500/5 text-violet-100 ring-violet-400/30',
    requiresModel: true,
    inputs: [{ key: '学习问题', description: '待讲解的知识点、困惑或学习目标', required: true }],
    outputs: [{ key: '辅导结果', description: '讲解、建议与下一步学习路径', required: true }],
  },
  agent_visual_site: {
    label: '可视化站点 Agent',
    icon: PanelsTopLeft,
    description: '固定调用子后端可视化站点 Agent',
    accentClassName: 'from-rose-500/20 to-pink-500/5 text-rose-100 ring-rose-400/30',
    requiresModel: true,
    inputs: [{ key: '页面需求', description: '页面目标、内容与布局约束', required: true }],
    outputs: [{ key: '页面草案', description: '页面结构、区块说明或 HTML 初稿', required: true }],
  },
};

export function getNodeTypeMeta(nodeType?: string) {
  return NODE_TYPE_META[(nodeType as NodeType) ?? 'chat_response'] ?? NODE_TYPE_META.chat_response;
}
