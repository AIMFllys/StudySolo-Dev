import { useState, useEffect } from 'react';

interface NavbarProps {
  isDark?: boolean;
  toggleTheme?: () => void;
}

const NAV_ITEMS = [
  { label: '工作流示例', id: 'workflow' },
  { label: '核心特性', id: 'features' },
  { label: '技术架构', id: 'architecture' },
  { label: '定价', id: 'pricing' },
];

export default function Navbar({ }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-inner">
        {/* Logo */}
        <div className="navbar-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ cursor: 'pointer' }}>
          <img
            src={`${import.meta.env.BASE_URL}StudySolo.png`}
            alt="StudySolo"
            className="navbar-logo-icon"
          />
          <span className="navbar-logo-name">StudySolo</span>
        </div>

        {/* Nav links */}
        <div className={`navbar-nav${mobileOpen ? ' open' : ''}`}>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className="navbar-link"
              onClick={() => scrollTo(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="navbar-actions">
          {/* Live status badge */}
          <div className="navbar-status">
            <div className="navbar-status-dot" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>LIVE</span>
          </div>

          <a
            href="https://StudyFlow.1037solo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
          >
            立即体验 →
          </a>

          {/* Mobile toggle */}
          <button
            className="navbar-mobile-toggle"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>
    </nav>
  );
}
