import { useState } from 'react';
import { useInView } from '../hooks/useInView';

// All data strictly from README.md and competition spec
const FEATURES = [
  {
    id: 'nlp',
    icon: '▸',
    title: '自然语言驱动',
    short: '说出目标，AI 自动生成工作流',
    desc: '用户无需了解 DAG、节点、连线等工程概念。在侧边栏 AI 面板用自然语言描述学习目标，系统完成从意图分类到工作流生成的全链路自动化。支持从零构建、增量修改、规划建议三种交互模式。',
    demo: [
      { type: 'user', content: '帮我系统学习机器学习基础，输出学习材料' },
      { type: 'sys', content: '意图: BUILD 已识别\n规划层激活中...' },
      { type: 'gen', content: '生成 6 节点工作流:\ntrigger → analyzer → outline_gen\n→ summary → flashcard → export_file' },
    ],
    tags: ['Intent Classifier', 'AI Planner', 'Action Executor'],
  },
  {
    id: 'canvas',
    icon: '⊞',
    title: '可视化节点画布',
    short: '拖拽式 DAG 编辑，Undo/Redo',
    desc: '基于 @xyflow/react 的工业级节点画布，支持拖动、增删节点、连线，以及分组操作。画布状态实时序列化，IndexedDB 防抖 500ms 本地快照 + Supabase 5s 节流云端同步，保障崩溃恢复。',
    demo: [
      { type: 'sys', content: 'Canvas State Monitor' },
      { type: 'info', content: 'nodes: 6  edges: 5  dirty: true' },
      { type: 'info', content: 'IndexedDB snapshot @ 300ms debounce' },
      { type: 'info', content: 'Supabase sync @ 5s throttle' },
      { type: 'ok', content: 'Undo stack: 12 snapshots' },
    ],
    tags: ['@xyflow/react', 'Zustand', 'IndexedDB'],
  },
  {
    id: 'nodes',
    icon: '◈',
    title: '18 种专业学习节点',
    short: '覆盖学习全流程的专用节点体系',
    desc: '平台预置 18 种节点，涵盖输入类（trigger / knowledge_base / web_search）、分析类（ai_analyzer / ai_planner / content_extract / compare）、生成类（outline_gen / summary / flashcard / quiz_gen / mind_map / merge_polish）、交互类、输出类、控制流六大类别。',
    demo: [
      { type: 'sys', content: '// 节点体系 (18种)' },
      { type: 'info', content: '输入类: trigger, knowledge_base, web_search' },
      { type: 'info', content: '分析类: ai_analyzer, ai_planner...' },
      { type: 'info', content: '生成类: outline_gen, summary, flashcard...' },
      { type: 'info', content: '控制流: logic_switch, loop_group' },
    ],
    tags: ['6 大类别', '用户可自建', '社区共享'],
  },
  {
    id: 'router',
    icon: '⟳',
    title: '多平台 AI 模型路由',
    short: '8 平台 17+ 模型，自动容灾降级',
    desc: '后端 AI Router 对接 8 个主流大模型平台（DeepSeek、通义千问、智谱 GLM、豆包、Kimi、七牛云、硅基流动、火山引擎），支持 native_first / proxy_first / capability_fixed 三种路由策略。单平台宕机自动切换，每个节点类型配置 2-3 个候选 SKU。',
    demo: [
      { type: 'sys', content: '// 路由策略: native_first' },
      { type: 'info', content: 'PRIMARY: DeepSeek-V3  [OK]' },
      { type: 'warn', content: 'FALLBACK: Qwen-Max  [TIMEOUT]' },
      { type: 'info', content: 'FALLBACK-2: GLM-4  [OK]' },
      { type: 'ok', content: 'Routed to GLM-4 in 89ms' },
    ],
    tags: ['8 AI 平台', '17+ 模型 SKU', '自动容灾'],
  },
  {
    id: 'sse',
    icon: '◉',
    title: '流式执行追踪',
    short: 'SSE 全程可观测，不是黑盒',
    desc: '执行时各节点按 DAG 依赖顺序逐步运行，通过 SSE 推送 7 种事件：node_input / node_status / node_token / node_done / loop_iteration / save_error / workflow_done。前端执行面板实时渲染状态、流式输出与链路血缘追踪。',
    demo: [
      { type: 'sys', content: 'SSE Stream Active' },
      { type: 'info', content: 'event: node_status\ndata: {node:"ai_analyzer",status:"running"}' },
      { type: 'info', content: 'event: node_token\ndata: {token:"机器学习是..."}' },
      { type: 'ok', content: 'event: node_done\ndata: {duration:2341,tokens:847}' },
    ],
    tags: ['7 种事件', 'Root-to-leaf 追踪', 'FastAPI SSE'],
  },
  {
    id: 'community',
    icon: '⊹',
    title: '社区共享与开放节点',
    short: '工作流与节点双重社区生态',
    desc: '工作流可发布至社区，其他用户可收藏、点赞、Fork 形成自己的版本。用户还可自定义并发布提示词节点：定义节点名称、Prompt、输出格式（支持 AI 辅助生成 JSON Schema），发布后进入社区节点商店，Prompt 对使用者不可见保护知识产权。',
    demo: [
      { type: 'sys', content: '// 社区数据' },
      { type: 'info', content: '发布工作流 "ML入门完整学习路径"' },
      { type: 'ok', content: 'status: 审核通过，已上线' },
      { type: 'info', content: 'forks: 12  likes: 47  usage: 389' },
    ],
    tags: ['Fork 分叉', '节点商店', '版权保护'],
  },
];

export default function Features() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [ref, inView] = useInView<HTMLDivElement>(0.1);

  const active = FEATURES[activeIdx];

  return (
    <section className="section" id="features" ref={ref}>
      <div className="container">
        {/* Header */}
        <div className={`section-header reveal${inView ? ' visible' : ''}`}>
          <div className="signal-tag">Core Features</div>
          <h2 className="section-title">核心特性体系</h2>
          <p className="section-desc">
            从自然语言到 DAG 执行，从单一模型到多平台路由，StudySolo 构建了完整的学习智能体平台能力。
          </p>
        </div>

        {/* Interactive feature panel */}
        <div className={`features-layout reveal reveal-delay-2${inView ? ' visible' : ''}`}>
          {/* Left: Tab list */}
          <div className="features-list">
            {FEATURES.map((f, i) => (
              <button
                key={f.id}
                className={`feature-tab${i === activeIdx ? ' active' : ''}`}
                onClick={() => setActiveIdx(i)}
              >
                <div className="feature-tab-icon">{f.icon}</div>
                <div className="feature-tab-text">
                  <div className="feature-tab-title">{f.title}</div>
                  <div className="feature-tab-desc">{f.short}</div>
                </div>
                {i === activeIdx && (
                  <span style={{
                    color: 'var(--green)',
                    fontSize: '0.7rem',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                  }}>→</span>
                )}
              </button>
            ))}
          </div>

          {/* Right: Detail panel */}
          <div className="feature-panel" key={active.id}>
            {/* Title */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.4rem' }}>{active.icon}</span>
                <h3 className="feature-panel-title">{active.title}</h3>
              </div>
              <p className="feature-panel-body">{active.desc}</p>
            </div>

            {/* Terminal demo */}
            <div className="terminal">
              <div className="terminal-header">
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['#ff5f57','#febc2e','#28c840'].map(c => (
                    <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  {active.id}.demo
                </span>
              </div>
              <div className="terminal-body">
                {active.demo.map((line, i) => (
                  <div
                    key={i}
                    className="terminal-line"
                    style={{
                      animationDelay: `${i * 150}ms`,
                      color: line.type === 'user' ? 'var(--text-primary)'
                        : line.type === 'ok' ? 'var(--green)'
                        : line.type === 'warn' ? 'var(--orange)'
                        : line.type === 'sys' ? 'var(--text-muted)'
                        : 'var(--ice)',
                    }}
                  >
                    {line.type === 'sys' && <span style={{ color: 'var(--text-muted)' }}># </span>}
                    {line.type === 'user' && <span style={{ color: 'var(--green)' }}>{'> '}</span>}
                    {line.type !== 'sys' && line.type !== 'user' && <span style={{ color: 'var(--text-muted)' }}>  </span>}
                    {line.content}
                  </div>
                ))}
                <div className="terminal-line">
                  <span style={{ color: 'var(--green)' }}>{'> '}</span>
                  <span className="terminal-cursor">_</span>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {active.tags.map(tag => (
                <span key={tag} style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--green)',
                  background: 'rgba(0,232,122,0.07)',
                  border: '1px solid var(--border-green)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
