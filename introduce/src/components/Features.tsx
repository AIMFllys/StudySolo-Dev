import { useState } from 'react';
import { useInView } from '../hooks/useInView';

const FEATURES = [
  {
    id: 'dag',
    title: 'DAG 图结构执行引擎',
    tag: 'CORE ENGINE',
    tagColor: 'var(--accent-blue)',
    desc: '系统内部对工作流执行拓扑排序（Topological Sort），严格按照节点依赖关系顺序调度 AI 模型。支持串行、并行、条件分支三种执行策略，任一节点失败将触发全局回滚。',
    detail: '自研 Python DAG Executor，完整支持：\n• 18 种执行节点类型\n• 拓扑排序 + 依赖解析\n• 并行组（Parallel Group）调度\n• 节点执行状态追踪',
    metrics: [
      { label: 'Node Types', value: '18' },
      { label: 'Max Parallel', value: '∞' },
      { label: 'Execution', value: 'SSE' },
    ],
  },
  {
    id: 'router',
    title: '多 AI 模型智能路由',
    tag: 'AI ROUTER',
    tagColor: 'var(--accent-violet)',
    desc: '不依赖单一模型。根据节点类型和任务复杂度，自动路由至最适合的 AI 模型：分析用 DeepSeek-V3，推导用 Qwen-MAX，长文本用专用模型。',
    detail: '基于注册表驱动的 AI 路由系统：\n• DeepSeek-V3（分析 + 规划节点）\n• Qwen-MAX（内容生成节点）\n• 多模型 Fallback 容错链\n• Token 成本优化路由策略',
    metrics: [
      { label: 'AI Providers', value: '8+' },
      { label: 'Routing', value: 'Auto' },
      { label: 'Fallback', value: 'Yes' },
    ],
  },
  {
    id: 'sse',
    title: '实时 SSE 执行日志流推',
    tag: 'STREAMING',
    tagColor: 'var(--accent-emerald)',
    desc: '不是黑盒转圈圈。工作流从触发到完成的每一步：节点状态变更、模型推理输出、分支判定结果，都以毫秒级流式推送至前端实时展现。',
    detail: 'FastAPI StreamingResponse 实现：\n• SSE (Server-Sent Events) 协议\n• 节点 PENDING → RUNNING → DONE 状态机\n• 前端 fetch + ReadableStream 解析\n• 生产环境 Nginx 无缓冲配置',
    metrics: [
      { label: 'Latency', value: '<800ms' },
      { label: 'Protocol', value: 'SSE' },
      { label: 'Format', value: 'NDJSON' },
    ],
  },
  {
    id: 'rls',
    title: 'RLS 行级安全数据隔离',
    tag: 'SECURITY',
    tagColor: 'var(--accent-red)',
    desc: '完全基于 Supabase 的 Row Level Security 策略。每个用户只能访问并操作自己的工作流、知识库和导出文件。数据库层强制隔离，绕不过去。',
    detail: 'Supabase RLS 实现方案：\n• JWT 令牌绑定用户身份\n• Policy: auth.uid() = user_id\n• API 层 + DB 层双重防护\n• IP 登录安全锁定（失败 5次封 10min）',
    metrics: [
      { label: 'Auth', value: 'JWT' },
      { label: 'Isolation', value: 'Row-Level' },
      { label: 'Lock', value: '5-attempt' },
    ],
  },
  {
    id: 'canvas',
    title: '工业级 DAG 可视化画布',
    tag: 'UI/UX',
    tagColor: 'var(--accent-blue)',
    desc: '基于 @xyflow/react 构建的拖拽式工作流编辑器。节点间连线自动布局，支持画布缩放/平移、小地图导航、节点属性面板实时编辑，全程零代码。',
    detail: '@xyflow/react 定制实现：\n• 18 种节点自定义渲染器\n• 拖拽添加/连接/删除\n• 小地图缩略图导航\n• 节点属性侧边栏编辑器',
    metrics: [
      { label: 'Library', value: 'XYFlow' },
      { label: 'Node Types', value: '18' },
      { label: 'Interaction', value: 'Drag & Drop' },
    ],
  },
  {
    id: 'export',
    title: '多格式学习成果导出',
    tag: 'OUTPUT',
    tagColor: 'var(--accent-violet)',
    desc: '工作流执行完成后，自动将知识大纲、核心总结、闪卡、思维导图、测验题等内容整合打包，支持 Markdown / TXT / DOCX 格式导出，一键归档。',
    detail: '导出节点能力矩阵：\n• 大纲生成（structured outline）\n• 核心总结（key summary）\n• 闪卡包（flashcard JSON）\n• 思维导图（Markdown structure）\n• 测验题（Q&A pairs）',
    metrics: [
      { label: 'Formats', value: 'MD/TXT/DOCX' },
      { label: 'Auto-merge', value: 'Yes' },
      { label: 'Async', value: 'Background' },
    ],
  },
];

export default function Features() {
  const [active, setActive] = useState(0);
  const [panelRef, panelInView] = useInView<HTMLDivElement>(0.2);
  const current = FEATURES[active];

  return (
    <section id="features" style={{
      padding: '120px 0',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        {/* Header */}
        <div className="reveal" style={{ marginBottom: 64, textAlign: 'center' }}>
          <span className="label label-blue" style={{ marginBottom: 20, display: 'inline-flex' }}>
            PLATFORM CAPABILITIES
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
            不止于对话
            <br />
            <span className="marker-highlight" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>完整的工程级架构</span>
          </h2>
          <p style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            我们不仅仅包装了 LLM 的 API，更是从底层构建了支撑复杂学习流的生产级平台。
          </p>
        </div>

        {/* Interactive 2-Column Layout */}
        <div ref={panelRef} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.5fr',
          gap: 32,
          opacity: panelInView ? 1 : 0,
          transform: panelInView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>

          {/* Left: Feature Selector Tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map((f, i) => (
              <div
                key={f.id}
                onClick={() => setActive(i)}
                style={{
                  padding: '20px 24px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  background: active === i ? '#ffffff' : 'transparent',
                  border: `1px solid ${active === i ? 'var(--border-subtle)' : 'transparent'}`,
                  boxShadow: active === i ? '0 4px 6px -1px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all var(--dur-fast) var(--ease-standard)',
                  transform: active === i ? 'translateX(8px)' : 'none',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: active === i ? f.tagColor : 'var(--text-dim)',
                  letterSpacing: '0.1em',
                  marginBottom: 8,
                }}>
                  {f.tag}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 16,
                  color: active === i ? 'var(--text-primary)' : 'var(--text-secondary)',
                  lineHeight: 1.4,
                }}>
                  {f.title}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Detail Card */}
          <div key={current.id} style={{
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)',
            padding: 48,
            display: 'flex',
            flexDirection: 'column',
            gap: 40,
            position: 'relative',
            overflow: 'hidden',
            animation: panelInView ? 'fadeInCard var(--dur-slow) var(--ease-standard)' : 'none',
          }}>
            {/* Soft background glow based on active item color */}
            <div style={{
              position: 'absolute',
              top: -100,
              right: -100,
              width: 300,
              height: 300,
              background: current.tagColor,
              opacity: 0.05,
              filter: 'blur(60px)',
              pointerEvents: 'none',
              transition: 'background var(--dur-slow) var(--ease-standard)',
            }} />

            {/* Title Area */}
            <div style={{ position: 'relative', zIndex: 10 }}>
              <span className="label" style={{ backgroundColor: `${current.tagColor}15`, color: current.tagColor, borderColor: `${current.tagColor}30`, marginBottom: 16, display: 'inline-flex' }}>
                {current.tag}
              </span>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 32,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                marginBottom: 20,
              }}>
                {current.title}
              </h3>
              <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                {current.desc}
              </p>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, position: 'relative', zIndex: 10 }}>
              {current.metrics.map((m, i) => (
                <div key={m.label} style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 16,
                  border: '1px solid var(--border-subtle)',
                  padding: '20px',
                  textAlign: 'center',
                  opacity: panelInView ? 1 : 0,
                  transform: panelInView ? 'translateY(0)' : 'translateY(12px)',
                  transition: `opacity 0.35s ease ${i * 0.08}s, transform 0.35s ease ${i * 0.08}s`,
                }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 24,
                    color: 'var(--text-primary)',
                    marginBottom: 8,
                  }}>
                    {m.value}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Tech Detail (Subtle list instead of terminal) */}
            <div style={{
              background: 'var(--bg-surface)',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              padding: 24,
              position: 'relative',
              zIndex: 10,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '0.05em',
                marginBottom: 16,
              }}>
                TECHNICAL SPECIFICATION
              </div>
              <ul style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}>
                {current.detail.split('\n').map((line, idx) => {
                  if (idx === 0) return <li key={idx} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 500 }}>{line}</li>;
                  return (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 14, color: 'var(--text-secondary)' }}>
                      <span style={{ color: current.tagColor, marginTop: 2 }}>✓</span>
                      {line.replace('• ', '')}
                    </li>
                  )
                })}
              </ul>
            </div>

          </div>
        </div>

        {/* Responsive Adjustments */}
        <style>{`
          @keyframes fadeInCard {
            from { opacity: 0.4; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @media (max-width: 900px) {
            #features > div > div:nth-child(2) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
