import {
  Brain,
  Workflow,
  Network,
  Sparkles,
  Users,
  Layers,
} from 'lucide-react';

export const LANDING_FEATURES = [
  {
    icon: Sparkles,
    id: '01',
    title: '自然语言生成工作流',
    description: '用一句话描述学习目标，AI 自动生成包含多步骤的可视化工作流，无需理解 DAG 或连线逻辑。',
  },
  {
    icon: Workflow,
    id: '02',
    title: '可视化编排与执行',
    description: '拖拽画布自由编辑节点与连线，分步流式执行全程可观测，输入输出状态实时可见。',
  },
  {
    icon: Brain,
    id: '03',
    title: '18 种智能体节点',
    description: '涵盖大纲生成、知识提炼、闪卡记忆、测验评估等学习全流程，每个节点即一个独立智能体。',
  },
  {
    icon: Users,
    id: '04',
    title: '社区共享与节点共建',
    description: '发布工作流至社区供他人 Fork 复用，自定义提示词节点上架节点商店，共建学习生态。',
  },
  {
    icon: Layers,
    id: '05',
    title: '多模型智能路由',
    description: '对接 8 大 AI 平台、17+ 模型 SKU，自动选择最优模型并支持多级容灾降级。',
  },
  {
    icon: Network,
    id: '06',
    title: 'DAG 执行引擎',
    description: '自研拓扑排序执行引擎，支持条件分支、循环容器，通过 SSE 流式推送节点执行进度。',
  },
];

export const LANDING_SCENARIOS = [
  {
    title: '系统化学习新领域',
    desc: '输入"机器学习入门"，自动生成目标拆解 → 大纲生成 → 内容提取 → 总结归纳 → 闪卡 → 测验的完整工作流。',
  },
  {
    title: '课后复习与知识巩固',
    desc: '上传课程 PDF 至知识库节点，连接内容提取与闪卡生成，快速将课件转化为记忆卡片。',
  },
  {
    title: '社区共享学习流程',
    desc: '构建论文阅读工作流并发布社区，其他用户直接 Fork 使用，无需从零设计。',
  },
];

export const LANDING_TECH_STACK = [
  { label: '前端', value: 'Next.js 15 + React 19' },
  { label: '后端', value: 'Python FastAPI' },
  { label: '画布引擎', value: 'React Flow' },
  { label: '数据库', value: 'Supabase PostgreSQL' },
  { label: '节点类型', value: '18 种' },
  { label: 'AI 平台', value: '8 个' },
  { label: '模型 SKU', value: '17+' },
  { label: '管理模块', value: '10 个' },
];
