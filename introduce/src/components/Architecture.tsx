import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';

/* Architecture based strictly on actual system */
const STACK = [
  {
    tier: 'FRONTEND',
    port: ':2037',
    color: 'var(--accent-blue)',
    tech: 'Next.js 14 + React 19',
    items: ['App Router (SSR + CSR)', 'Zustand 状态管理', '@xyflow/react 工作流画布', 'Tailwind CSS v4', 'TypeScript 5.x'],
    note: 'Deployed as Node.js server (Nginx → :2037)',
  },
  {
    tier: 'BACKEND',
    port: ':2038',
    color: 'var(--accent-emerald)',
    tech: 'Python FastAPI',
    items: ['Uvicorn ASGI Server', 'SSE StreamingResponse', 'DAG Executor (自研)', 'Pydantic v2 数据校验', 'AI Router 分发层'],
    note: 'uvicorn --workers 2 (Nginx → /api/)',
  },
  {
    tier: 'DATABASE',
    port: 'PG',
    color: 'var(--accent-violet)',
    tech: 'Supabase PostgreSQL',
    items: ['Row Level Security (RLS)', 'Supabase Auth (JWT)', 'profiles / workflows / nodes 表', 'knowledge_bases 知识库', 'IP 登录锁定记录表'],
    note: 'Supabase Cloud (us-east-1)',
  },
  {
    tier: 'INFRASTRUCTURE',
    port: 'ECS',
    color: 'var(--accent-rose)',
    tech: 'Aliyun ECS + Nginx',
    items: ['Nginx 统一反向代理网关', '1C/2G 轻量云服务器', 'PM2 进程管理', 'SSL/HTTPS 全站加密', '*.1037solo.com 泛域名'],
    note: '1037solo.com ecosystem',
  },
];

const ROUTING = [
  { from: 'studyflow.1037solo.com/', to: 'Next.js :2037', protocol: 'HTTP PROXY', active: true },
  { from: 'studyflow.1037solo.com/api/', to: 'FastAPI :2038', protocol: 'HTTP PROXY', active: true },
  { from: '1037solo.com/introduce/', to: 'Vite SPA (Static)', protocol: 'STATIC FILE', active: true },
  { from: '→ Supabase', to: 'PostgreSQL DB', protocol: 'SUPABASE SDK', active: true },
];

export default function Architecture() {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const [activeRoute, setActiveRoute] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      setActiveRoute((prev) => (prev + 1) % ROUTING.length);
    }, 1800);
    return () => window.clearInterval(timer);
  }, [inView]);

  return (
    <section id="arch" style={{
      padding: '120px 0',
      position: 'relative',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: 64, textAlign: 'center' }}>
          <span className="label label-blue" style={{ marginBottom: 20, display: 'inline-flex' }}>
            SYSTEM ARCHITECTURE
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
            不止于单体应用
            <br />
            <span className="marker-highlight" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>Polyglot Monorepo 架构</span>
          </h2>
          <p style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            maxWidth: 600,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            多语言单仓库架构，前后端完全独立部署。生产环境运行于阿里云 ECS，Nginx 统一网关分发。
          </p>
        </div>

        {/* Nginx Routing Table */}
        <div ref={ref} style={{
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.025)',
          marginBottom: 32,
          overflow: 'hidden',
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}>
          <div style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              nginx.conf
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              — 生产路由映射
            </span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-emerald)', boxShadow: '0 0 0 4px rgba(16, 185, 129, 0.1)' }} />
              <span style={{ color: 'var(--text-primary)' }}>PRODUCTION</span>
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                  {['Request Path', 'Routes To', 'Protocol', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '14px 24px',
                      textAlign: 'left',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROUTING.map((r, i) => (
                  <tr
                    key={i}
                    className={`route-row ${inView && i === activeRoute ? 'active' : ''}`}
                    style={{ borderBottom: i === ROUTING.length - 1 ? 'none' : '1px solid var(--border-subtle)' }}
                  >
                    <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent-blue)' }}>{r.from}</td>
                    <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)' }}>{r.to}</td>
                    <td style={{ padding: '16px 24px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>{r.protocol}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--accent-emerald)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '4px 10px',
                        borderRadius: 999,
                        width: 'fit-content',
                      }}>
                        <span className={inView && i === activeRoute ? 'flow-pulse' : ''} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-emerald)' }} />
                        ONLINE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stack Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
        }}>
          {STACK.map((s, i) => (
            <div key={s.tier} style={{
              background: '#ffffff',
              borderRadius: 24,
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
              padding: 32,
              position: 'relative',
              overflow: 'hidden',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(24px)',
              transition: `opacity 0.6s var(--ease-standard) ${i * 0.1}s, transform 0.6s var(--ease-standard) ${i * 0.1}s, box-shadow var(--dur-fast) var(--ease-standard)`,
            }}
            >
              {/* Subtle gradient background based on brand color */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: s.color,
              }} />

              {/* Tier Label + Port */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span className="label" style={{ backgroundColor: `${s.color}15`, color: s.color, borderColor: `${s.color}30` }}>
                  {s.tier}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: s.color,
                  background: `${s.color}15`,
                  padding: '4px 8px',
                  borderRadius: 6,
                }}>
                  {s.port}
                </span>
              </div>

              {/* Tech Name */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--text-primary)',
                marginBottom: 20,
                lineHeight: 1.3,
              }}>
                {s.tech}
              </div>

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flexGrow: 1 }}>
                {s.items.map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: s.color, flexShrink: 0, marginTop: 1, fontWeight: 600 }}>✓</span>
                    <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* Note */}
              <div style={{
                borderTop: '1px solid var(--border-subtle)',
                paddingTop: 16,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-dim)',
                letterSpacing: '0.05em',
              }}>
                {s.note}
              </div>
            </div>
          ))}
        </div>

        {/* Responsive Adjustments */}
        <style>{`
          @media (max-width: 1024px) {
            #arch > div > div:nth-child(3) {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 640px) {
            #arch > div > div:nth-child(3) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
