import { useInView } from '../hooks/useInView';

// Tech stack strictly from README.md
const ARCH_CELLS = [
  {
    layer: 'FRONTEND',
    title: 'Next.js 16 + React 19',
    tech: 'TypeScript · Tailwind CSS v4',
    desc: 'App Router，SSR + CSR 混合渲染。@xyflow/react 工业级画布，Zustand 全局状态，Framer Motion 动画，IndexedDB 离线缓存。',
    port: ':2037',
    color: 'var(--ice)',
  },
  {
    layer: 'BACKEND',
    title: 'Python FastAPI',
    tech: 'uvicorn · Pydantic',
    desc: '高性能异步框架，原生支持 SSE 流式推送。自研 DAG Executor（拓扑排序 + ExecutionContext 黑板模型）。Prompt 模块化系统（Markdown + 变量渲染 + LRU 缓存）。',
    port: ':2038',
    color: 'var(--orange)',
  },
  {
    layer: 'DATABASE',
    title: 'Supabase PostgreSQL',
    tech: 'Row Level Security · JWT',
    desc: '多租户数据隔离，RLS 全覆盖。Supabase Auth + JWT + Canvas 拼图验证码 + IP 登录锁定。10+ 核心数据库表。',
    port: 'SUPABASE',
    color: 'var(--green)',
  },
  {
    layer: 'AI ROUTER',
    title: '8 平台 · 17+ 模型',
    tech: 'DeepSeek · Qwen · GLM · Kimi...',
    desc: '统一 AI Router 对接 8 个主流大模型平台。3 种路由策略：native_first / proxy_first / capability_fixed。每节点 2-3 个候选 SKU，单平台宕机自动降级。',
    port: 'ROUTER',
    color: 'var(--ice)',
  },
  {
    layer: 'EXECUTION',
    title: 'DAG Executor',
    tech: 'SSE · ExecutionContext',
    desc: '自研执行引擎：拓扑排序确定顺序，ExecutionContext 黑板模型传递中间结果。推送 7 种 SSE 事件，链路血缘全程可视。双缓冲同步：IndexedDB(300ms) + Supabase(5s)。',
    port: 'ENGINE',
    color: 'var(--green)',
  },
  {
    layer: 'HOSTING',
    title: '阿里云 ECS + Nginx',
    tech: 'PM2 · Baota · HTTPS',
    desc: '已生产部署上线：StudyFlow.1037solo.com。Nginx 统一网关分发：前端(2037) / API(2038) / 介绍页(静态)。PM2 进程守护，宝塔 Python 管理器。',
    port: ':443',
    color: 'var(--text-muted)',
  },
];

const DEPLOY_PATH = [
  { label: 'studyflow.1037solo.com/', target: 'Next.js :2037', icon: '⊞' },
  { label: '/api/', target: 'FastAPI :2038', icon: '◈' },
  { label: '/introduce/', target: 'Vite SPA (静态)', icon: '▸' },
  { label: '/wiki/', target: 'Next.js :2039 (开发中)', icon: '⊹' },
];

export default function Architecture() {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);

  return (
    <section className="section" id="architecture" ref={ref}>
      <div className="container">
        {/* Header */}
        <div className={`section-header center reveal${inView ? ' visible' : ''}`}>
          <div className="signal-tag">System Architecture</div>
          <h2 className="section-title">Polyglot Monorepo 架构</h2>
          <p className="section-desc">
            多语言单仓架构，前后端完全独立部署，Nginx 统一网关分发。已在阿里云 ECS 生产运行。
          </p>
        </div>

        {/* Nginx routing diagram */}
        <div className={`reveal reveal-delay-1${inView ? ' visible' : ''}`} style={{ marginBottom: '2rem' }}>
          <div style={{
            background: 'var(--black-2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '0.6rem 1rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.02)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                nginx.conf — 生产路由
              </span>
              <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--green)' }}>
                LIVE ◉
              </span>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {DEPLOY_PATH.map(item => (
                <div key={item.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                }}>
                  <span style={{ color: 'var(--ice)', minWidth: 280 }}>{item.label}</span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span style={{ color: 'var(--green)' }}>{item.icon}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{item.target}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tech grid */}
        <div className={`arch-grid reveal reveal-delay-2${inView ? ' visible' : ''}`}>
          {ARCH_CELLS.map(cell => (
            <div key={cell.layer} className="arch-cell">
              <div className="arch-cell-glow" />
              <div className="arch-cell-layer">{cell.layer}</div>
              <div className="arch-cell-title">{cell.title}</div>
              <div className="arch-cell-tech" style={{ color: cell.color }}>
                {cell.tech}
              </div>
              <div className="arch-cell-desc">{cell.desc}</div>
              <div style={{
                marginTop: '1rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
                color: 'var(--text-faint)',
                borderTop: '1px solid var(--border)',
                paddingTop: '0.75rem',
              }}>
                {cell.port}
              </div>
            </div>
          ))}
        </div>

        {/* Scale metrics */}
        <div className={`reveal reveal-delay-3${inView ? ' visible' : ''}`} style={{ marginTop: '2rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'var(--border)',
          }}>
            {[
              { v: '60+', l: 'React 组件' },
              { v: '27+', l: 'API 端点' },
              { v: '18', l: '节点类型' },
              { v: '10+', l: '数据库表 (RLS)' },
              { v: '10', l: '管理后台模块' },
              { v: '7', l: 'SSE 事件类型' },
            ].map(m => (
              <div key={m.l} style={{
                background: 'var(--black-3)',
                padding: '1.25rem 1rem',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.75rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}>
                  {m.v}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.4rem',
                }}>
                  {m.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
