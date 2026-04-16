import { useEffect, useState } from 'react';
import './index.css';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Home, Puzzle, Target, Settings, Gem } from 'lucide-react';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Hero from './components/Hero';
import WorkflowDemo from './components/WorkflowDemo';
import NodeGallery from './components/NodeGallery';
import Scenarios from './components/Scenarios';
import Features from './components/Features';
import PlatformEcosystem from './components/PlatformEcosystem';
import AIRouter from './components/AIRouter';
import Architecture from './components/Architecture';
import SystemStatus from './components/SystemStatus';
import Pricing from './components/Pricing';

/* ===== Fonts ===== */
function useFonts() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);
}

/* ===== Scroll Reveal ===== */
function ScrollReveal() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
  return null;
}

/* ===== Scroll to Top on navigate ===== */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/* ===== Pages ===== */

/** 首页：Hero + WorkflowDemo */
function PageHome() {
  return (
    <>
      <Hero onStart={() => window.open('https://studyflow.1037solo.com', '_blank')} onGuide={() => window.open('https://github.com/AIMFllys/StudySolo', '_blank')} />
      <WorkflowDemo />
    </>
  );
}

/** 节点体系 + AI路由 */
function PageNodes() {
  return (
    <>
      <div style={{ paddingTop: 80 }}>
        <NodeGallery />
        <AIRouter />
      </div>
    </>
  );
}

/** 应用场景 */
function PageScenarios() {
  return (
    <div style={{ paddingTop: 80 }}>
      <Scenarios />
    </div>
  );
}

/** 技术架构 + Features */
function PageTech() {
  return (
    <div style={{ paddingTop: 80 }}>
      <Features />
      <PlatformEcosystem />
      <Architecture />
      <SystemStatus />
    </div>
  );
}

/** 定价 */
function PagePricing() {
  return (
    <div style={{ paddingTop: 80 }}>
      <Pricing />
    </div>
  );
}

/* ===== Page Loader ===== */
function PageLoader() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`page-loader${!loading ? ' loaded' : ''}`}>
      <div className="loader-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 24, height: 24, border: '1px solid rgba(0,255,136,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <img src={`${import.meta.env.BASE_URL}StudySolo.png`} alt="Logo" style={{ width: 14, height: 14, objectFit: 'contain' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent-green)', fontWeight: 700 }}>
            STUDYSOLO
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 16 }}>
          INITIALIZING DAG ENGINE...
        </div>
        <div className="loader-bar"><div className="loader-bar-fill" /></div>
      </div>
    </div>
  );
}

/* ===== Floating Page Navigation ===== */
const PAGES = [
  { path: '/', label: '首页', icon: Home, eng: 'HOME' },
  { path: '/nodes', label: '节点体系', icon: Puzzle, eng: 'NODES' },
  { path: '/scenarios', label: '应用场景', icon: Target, eng: 'SCENARIOS' },
  { path: '/tech', label: '技术架构', icon: Settings, eng: 'TECH' },
  { path: '/pricing', label: '定价', icon: Gem, eng: 'PRICING' },
];

function FloatingPageNav() {
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  const [touchExpanded, setTouchExpanded] = useState(false);
  const isExpanded = expanded || touchExpanded;

  return (
    <div
      onClick={() => setTouchExpanded((prev) => !prev)}
      style={{
      position: 'fixed',
      left: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}
    >
      {PAGES.map((page) => {
        const isActive = pathname === page.path;
        const Icon = page.icon;
        return (
          <Link
            key={page.path}
            to={page.path}
            title={page.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: isExpanded ? '10px 16px' : '10px 10px',
              background: isActive ? 'var(--accent-blue)' : 'rgba(255,255,255,0.95)',
              color: isActive ? '#ffffff' : 'var(--text-secondary)',
              textDecoration: 'none',
              borderRadius: '0 10px 10px 0',
              borderRight: `1px solid ${isActive ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
              borderTop: '1px solid var(--border-subtle)',
              borderBottom: '1px solid var(--border-subtle)',
              transition: 'all var(--dur-fast) var(--ease-standard)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: isExpanded ? 200 : 44,
            }}
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
          >
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={18} strokeWidth={isActive ? 2.5 : 2} color={isActive ? '#ffffff' : 'currentColor'} />
            </span>
            {isExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, lineHeight: 1 }}>{page.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: 0.6, letterSpacing: '0.05em' }}>{page.eng}</span>
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/* ===== App Root ===== */
export default function App() {
  useFonts();

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollToTop />
      <PageLoader />
      <ScrollReveal />
      <div style={{ background: 'var(--bg-canvas)', minHeight: '100dvh' }}>
        <Navbar />
        <FloatingPageNav />
        <main>
          <Routes>
            <Route path="/" element={<PageHome />} />
            <Route path="/nodes" element={<PageNodes />} />
            <Route path="/scenarios" element={<PageScenarios />} />
            <Route path="/tech" element={<PageTech />} />
            <Route path="/pricing" element={<PagePricing />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}
