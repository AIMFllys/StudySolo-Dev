import { useMemo, useState } from 'react';
import { useInView } from '../hooks/useInView';
import {
  AppWindow,
  BookOpen,
  Database,
  Download,
  FileText,
  HelpCircle,
  Map,
  MessageSquare,
  Microscope,
  Network,
  Repeat,
  Scale,
  Scissors,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: '全部节点', color: 'var(--text-primary)' },
  { id: 'input', label: '输入类', color: 'var(--accent-green)' },
  { id: 'analysis', label: '分析类', color: 'var(--accent-blue)' },
  { id: 'generate', label: '生成类', color: 'var(--accent-purple)' },
  { id: 'interaction', label: '交互类', color: 'var(--accent-rose)' },
  { id: 'output', label: '输出类', color: 'var(--accent-emerald)' },
  { id: 'control', label: '控制流', color: 'var(--accent-amber)' },
];

const NODES = [
  {
    id: 'trigger_input',
    name: 'Trigger Input',
    label: '工作流触发器',
    category: 'input',
    icon: Zap,
    desc: '工作流入口，承载用户初始学习目标，是整个执行链路的起点。',
    detail: '接受自然语言与结构化任务描述，并注入 ExecutionContext。',
  },
  {
    id: 'knowledge_base',
    name: 'Knowledge Base',
    label: '知识库检索',
    category: 'input',
    icon: BookOpen,
    desc: '支持文档上传与内容注入，提供向量检索与语义召回。',
    detail: '支持 PDF/TXT/MD，向量化存储并执行多深度检索策略。',
  },
  {
    id: 'web_search',
    name: 'Web Search',
    label: '联网搜索',
    category: 'input',
    icon: Search,
    desc: '多源并发检索，从权威内容到社区观点分层归并。',
    detail: '搜索 API + Qwen 汇总，支持深度搜索模式。',
  },
  {
    id: 'ai_analyzer',
    name: 'AI Analyzer',
    label: '深度分析',
    category: 'analysis',
    icon: Microscope,
    desc: '多维度推理分析，抽取核心逻辑与关键洞察。',
    detail: 'DeepSeek-R1 推理链，支持结构化输出。',
  },
  {
    id: 'ai_planner',
    name: 'AI Planner',
    label: '学习规划',
    category: 'analysis',
    icon: Map,
    desc: '将学习目标拆解为结构化任务，并生成优先级序列。',
    detail: 'Qwen-Plus 规划，输出可执行 JSON 路径。',
  },
  {
    id: 'content_extract',
    name: 'Content Extract',
    label: '内容提取',
    category: 'analysis',
    icon: Scissors,
    desc: '从长文本中提取关键要点，过滤噪音保留知识核心。',
    detail: 'Kimi 长文场景，支持超大文本解析。',
  },
  {
    id: 'compare',
    name: 'Compare',
    label: '对比分析',
    category: 'analysis',
    icon: Scale,
    desc: '多维度对比不同观点与方案，输出可决策矩阵。',
    detail: '支持多路输入合并，产出双维度对比表。',
  },
  {
    id: 'outline_gen',
    name: 'Outline Gen',
    label: '大纲生成',
    category: 'generate',
    icon: FileText,
    desc: '生成分层知识大纲，支持 2-5 级标题树结构。',
    detail: 'Qwen-MAX 输出，支持章节与子要点展开。',
  },
  {
    id: 'summary',
    name: 'Summary',
    label: '总结归纳',
    category: 'generate',
    icon: SlidersHorizontal,
    desc: '提炼精华，将复杂信息压缩为高质量知识摘要。',
    detail: '支持多源归纳并保留原始来源标注。',
  },
  {
    id: 'flashcard',
    name: 'Flashcard',
    label: '闪卡生成',
    category: 'generate',
    icon: AppWindow,
    desc: '结构化输出记忆卡片，适配间隔重复学习体系。',
    detail: '兼容 Anki 的 JSON 结构，包含标签与正反面。',
  },
  {
    id: 'quiz_gen',
    name: 'Quiz Gen',
    label: '测验生成',
    category: 'generate',
    icon: HelpCircle,
    desc: '自动生成选择/填空/简答题并附带参考答案。',
    detail: '结构化 JSON 输出，支持混合题型与解析。',
  },
  {
    id: 'mind_map',
    name: 'Mind Map',
    label: '思维导图',
    category: 'generate',
    icon: Network,
    desc: '生成 Markdown 导图结构，可直接导入常用工具。',
    detail: '层级 Markdown，兼容 XMind/Obsidian 等生态。',
  },
  {
    id: 'merge_polish',
    name: 'Merge & Polish',
    label: '合并润色',
    category: 'generate',
    icon: Sparkles,
    desc: '整合多路上游结果，统一风格并提升可读性。',
    detail: '支持 N 路汇聚，由 Qwen-Plus 统一输出风格。',
  },
  {
    id: 'chat_response',
    name: 'Chat Response',
    label: '对话回复',
    category: 'interaction',
    icon: MessageSquare,
    desc: '内嵌对话节点，在工作流中保持上下文连续。',
    detail: '流式输出，支持 Markdown 渲染。',
  },
  {
    id: 'export_file',
    name: 'Export File',
    label: '文件导出',
    category: 'output',
    icon: Download,
    desc: '将工作流结果导出为 Markdown/TXT 等格式。',
    detail: '前端即时生成，支持自定义文件名和格式。',
  },
  {
    id: 'write_db',
    name: 'Write DB',
    label: '数据持久化',
    category: 'output',
    icon: Database,
    desc: '将执行结果写入 Supabase，支持后续复用与检索。',
    detail: 'RLS 隔离，仅归属当前用户，支持版本追踪。',
  },
  {
    id: 'logic_switch',
    name: 'Logic Switch',
    label: '条件分支',
    category: 'control',
    icon: Shuffle,
    desc: '基于条件表达式进行分支控制，动态选择执行路径。',
    detail: '支持多条件表达式，并自动处理分支汇合。',
  },
  {
    id: 'loop_group',
    name: 'Loop Group',
    label: '循环容器',
    category: 'control',
    icon: Repeat,
    desc: '将一组节点封装为循环执行单元，支持迭代优化。',
    detail: '不同套餐支持不同轮次上限与并发迭代。',
  },
];

const CATEGORY_COLOR: Record<string, string> = {
  input: 'var(--accent-green)',
  analysis: 'var(--accent-blue)',
  generate: 'var(--accent-purple)',
  interaction: 'var(--accent-rose)',
  output: 'var(--accent-emerald)',
  control: 'var(--accent-amber)',
};

export default function NodeGallery() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [ref, inView] = useInView<HTMLDivElement>(0.1);

  const filtered = useMemo(
    () => (activeCategory === 'all' ? NODES : NODES.filter((n) => n.category === activeCategory)),
    [activeCategory]
  );

  const hovered = NODES.find(n => n.id === hoveredNode);

  return (
    <section id="nodes" className="grid-bg" style={{ padding: '40px 0 80px', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        {/* Header */}
        <div className="reveal" style={{ marginBottom: 64, textAlign: 'center' }}>
          <span className="label label-purple" style={{ marginBottom: 20, display: 'inline-flex' }}>
            NODE ECOSYSTEM · 18 TYPES
          </span>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(36px, 5vw, 56px)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 24,
          }}>
            每个节点，都是一个
            <br />
            <span className="marker-highlight" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>可编排的 AI 智能体</span>
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            18 种专业节点覆盖完整学习链路，通过 DAG 连接形成多智能体协作系统。
          </p>
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 48 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                border: `1px solid ${activeCategory === cat.id ? cat.color : 'var(--border-subtle)'}`,
                background: activeCategory === cat.id ? `${cat.color}15` : 'var(--bg-surface)',
                color: activeCategory === cat.id ? cat.color : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--dur-fast) var(--ease-standard)',
                letterSpacing: '0.05em',
              }}
            >
              {cat.label}
              {cat.id !== 'all' && (
                <span style={{ marginLeft: 6, opacity: 0.6 }}>
                  {NODES.filter(n => n.category === cat.id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Main Layout: Grid + Hover Detail */}
        <div ref={ref} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 32,
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>

          {/* Node Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
            alignContent: 'start',
          }}>
            {filtered.map((node, i) => {
              const color = CATEGORY_COLOR[node.category];
              const isHovered = hoveredNode === node.id;
              const IconComponent = node.icon;
              return (
                <div
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    background: '#ffffff',
                    borderRadius: 12,
                    border: `2px solid ${isHovered ? color : 'var(--border-subtle)'}`,
                    padding: 4,
                    cursor: 'pointer',
                    transition: 'all var(--dur-fast) var(--ease-standard)',
                    transform: isHovered ? 'translateY(-4px)' : 'none',
                    boxShadow: isHovered ? `0 12px 24px -4px ${color}25` : '0 2px 4px rgba(0,0,0,0.03)',
                    opacity: inView ? 1 : 0,
                    animation: inView ? `fadeUp 0.42s var(--ease-standard) ${i * 0.035}s both` : 'none',
                    position: 'relative',
                  }}
                >
                  {/* Left Handle */}
                  <div style={{
                    position: 'absolute', top: '50%', left: -5, transform: 'translateY(-50%)',
                    width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', border: '1.5px solid #fff',
                    zIndex: 2,
                  }} />
                  {/* Right Handle */}
                  <div style={{
                    position: 'absolute', top: '50%', right: -5, transform: 'translateY(-50%)',
                    width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', border: '1.5px solid #fff',
                    zIndex: 2,
                  }} />

                  {/* Inner Dashed/Solid wrapper (to simulate React Flow node look) */}
                  <div style={{
                    border: `1px dashed ${isHovered ? color : 'var(--border-subtle)'}`,
                    borderRadius: 8,
                    padding: 16,
                    height: '100%',
                    background: isHovered ? `${color}05` : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all var(--dur-fast) var(--ease-standard)',
                  }}>
                    <div style={{ marginBottom: 16 }}>
                      <IconComponent size={24} color={isHovered ? color : 'var(--text-secondary)'} strokeWidth={isHovered ? 2.5 : 2} style={{ transition: 'all 0.2s ease' }} />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      color,
                      letterSpacing: '0.05em',
                      marginBottom: 6,
                      textTransform: 'uppercase',
                    }}>
                      {node.name}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 700,
                      fontSize: 15,
                      color: 'var(--text-primary)',
                      lineHeight: 1.4,
                    }}>
                      {node.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hover Detail Panel */}
          <div style={{
            position: 'sticky',
            top: 100,
            height: 'fit-content',
          }}>
            {hovered ? (
              <div style={{
                background: '#ffffff',
                borderRadius: 24,
                border: `2px solid ${CATEGORY_COLOR[hovered.category]}`,
                padding: 32,
                boxShadow: `0 20px 40px -8px ${CATEGORY_COLOR[hovered.category]}20`,
                transition: 'all var(--dur-base) var(--ease-standard)',
              }}>
                <div style={{ marginBottom: 20 }}>
                  {(() => {
                    const HoveredIcon = hovered.icon;
                    return <HoveredIcon size={48} color={CATEGORY_COLOR[hovered.category]} strokeWidth={2} />;
                  })()}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: CATEGORY_COLOR[hovered.category],
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}>
                  {hovered.name}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 24,
                  color: 'var(--text-primary)',
                  marginBottom: 16,
                  lineHeight: 1.3,
                }}>
                  {hovered.label}
                </div>
                <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
                  {hovered.desc}
                </p>
                <div style={{
                  background: 'var(--bg-canvas)',
                  borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                  padding: '16px 20px',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-dim)',
                    letterSpacing: '0.1em',
                    marginBottom: 10,
                  }}>
                    TECHNICAL NOTE
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {hovered.detail}
                  </div>
                </div>
                <div style={{
                  marginTop: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: `${CATEGORY_COLOR[hovered.category]}15`,
                  border: `1px solid ${CATEGORY_COLOR[hovered.category]}30`,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    color: CATEGORY_COLOR[hovered.category],
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    {CATEGORIES.find(c => c.id === hovered.category)?.label}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 24,
                border: '2px dashed var(--border-subtle)',
                padding: 40,
                textAlign: 'center',
                color: 'var(--text-dim)',
              }}>
                <div style={{ marginBottom: 16, opacity: 0.3, display: 'flex', justifyContent: 'center' }}>
                  <Search size={48} strokeWidth={1.5} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, letterSpacing: '0.05em' }}>
                  悬停任意节点
                  <br />查看详细说明
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div style={{
              marginTop: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
            }}>
              {[
                { label: '节点总数', value: '18' },
                { label: '类别', value: '5+1' },
                { label: '已上线', value: '100%' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: '#ffffff',
                  borderRadius: 12,
                  border: '1px solid var(--border-subtle)',
                  padding: '14px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 20,
                    color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}>{stat.value}</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-dim)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Responsive */}
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 900px) {
            #nodes > div > div:last-child {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}

