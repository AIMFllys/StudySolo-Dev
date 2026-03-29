import { useInView } from '../hooks/useInView';

const FOOT_LINKS = {
  '产品': [
    { label: '在线体验', url: 'https://StudyFlow.1037solo.com', ext: true },
    { label: 'Demo 视频', url: 'https://b23.tv/uPd6KUr', ext: true },
    { label: '文档中心', url: 'https://docs.1037solo.com', ext: true },
    { label: 'GitHub', url: 'https://github.com/AIMFllys/StudySolo', ext: true },
  ],
  '技术': [
    { label: 'Next.js 16 + React 19', url: null },
    { label: 'Python FastAPI', url: null },
    { label: 'Supabase PostgreSQL', url: null },
    { label: 'DAG Executor (自研)', url: null },
  ],
  '社区': [
    { label: 'GitHub Issues', url: 'https://github.com/AIMFllys/StudySolo/issues', ext: true },
    { label: 'Pull Requests', url: 'https://github.com/AIMFllys/StudySolo/pulls', ext: true },
    { label: 'MIT License', url: 'https://github.com/AIMFllys/StudySolo/blob/main/LICENSE', ext: true },
  ],
};

const TECH_PILLS = [
  'React 19', 'Next.js 16', 'FastAPI', 'Supabase', 'SSE', 'DAG', 'Tailwind v4',
];

export default function Footer() {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);

  return (
    <footer className="footer" ref={ref}>
      <div className="container">
        <div className={`footer-grid reveal${inView ? ' visible' : ''}`}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
              <img
                src={`${import.meta.env.BASE_URL}StudySolo.png`}
                alt="StudySolo"
                style={{ width: 22, height: 22, objectFit: 'contain' }}
              />
              <div className="footer-brand-name">StudySolo</div>
            </div>
            <p className="footer-brand-desc">
              面向学习场景的 AI 工作流编排平台。<br />
              华科 AI 智能体大赛参赛作品。<br />
              MIT License · © 2026 1037Solo
            </p>

            {/* Live status */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.68rem',
              color: 'var(--green)',
              background: 'rgba(0,232,122,0.06)',
              border: '1px solid var(--border-green)',
              padding: '0.25rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--green)',
                boxShadow: '0 0 6px var(--green)',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              StudyFlow.1037solo.com LIVE
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOT_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <div className="footer-heading">{heading}</div>
              <div className="footer-links">
                {links.map(link => (
                  link.url ? (
                    <a
                      key={link.label}
                      href={link.url}
                      target={link.ext ? '_blank' : undefined}
                      rel={link.ext ? 'noopener noreferrer' : undefined}
                      className="footer-link"
                    >
                      {link.label}
                      {link.ext && <span style={{ color: 'var(--text-faint)', marginLeft: '0.2rem', fontSize: '0.7rem' }}>↗</span>}
                    </a>
                  ) : (
                    <span key={link.label} className="footer-link" style={{ cursor: 'default' }}>
                      {link.label}
                    </span>
                  )
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <div className="footer-copyright">
            面向学习场景的 AI 智能体可视化编排平台 · An Open Platform for Creating, Running, Sharing and Governing Learning Agents
          </div>
          <div className="footer-tech">
            {TECH_PILLS.map(t => (
              <span key={t} className="tech-pill">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
