import { useEffect, useRef, useState } from 'react';
import { useInView } from '../hooks/useInView';

/* === MOUSE PARALLAX HOOK === */
function useParallax() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || window.innerWidth < 900) {
      setPos({ x: 0, y: 0 });
      return;
    }

    const handler = (e: MouseEvent) => {
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        setPos({ x, y });
        rafRef.current = null;
      });
    };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handler);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);
  return pos;
}

/* === ANIMATED COUNTER === */
function Counter({ to, suffix = '', duration = 2000 }: { to: number; suffix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const [ref, inView] = useInView<HTMLSpanElement>(0.5);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const start = performance.now();
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * to));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [inView]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* === TICKER ITEMS === */
const TICKER_ITEMS = [
  '18 exectuion node types', 'DAG topology sort engine', 'SSE real-time streaming',
  'DeepSeek V3 router', 'Qwen-MAX parallel execution', 'RLS row-level security',
  'FastAPI async backend', 'Next.js 14 SSR frontend', 'Supabase Postgres DB',
  'Multi-tenant isolation', 'HUST AI Agent Competition', 'Open Source on GitHub',
];

const STATS = [
  { label: 'Execution Nodes', value: 18, suffix: '', color: 'var(--accent-blue)' },
  { label: 'AI Models Routed', value: 8, suffix: '+', color: 'var(--accent-green)' },
  { label: 'Workflow Steps', value: 12, suffix: '+', color: 'var(--accent-purple)' },
  { label: 'Response Latency', value: 800, suffix: 'ms', color: 'var(--accent-red)' },
];

interface HeroProps {
  onStart: () => void;
  onGuide: () => void;
}

export default function Hero({ onStart, onGuide }: HeroProps) {
  const parallax = useParallax();
  const [titleVisible, setTitleVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTitleVisible(true), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="hero"
      className="grid-bg"
      style={{
        position: 'relative',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start', /* Align left to match notebook style */
        overflow: 'hidden',
        paddingTop: 80,
        paddingLeft: '15%', /* Indent from the margin line */
      }}
    >
      {/* Background Watermarks */}
      <div className="watermark-text" style={{ top: '15%', left: '10%', transform: `translate(${parallax.x}px, ${parallax.y}px)` }}>化繁为简</div>
      <div className="watermark-text" style={{ top: '65%', left: '30%', transform: `translate(${parallax.x * 0.5}px, ${parallax.y * 0.5}px)` }}>核心知识提炼网络</div>

      {/* Main Content */}
      <div style={{ position: 'relative', zIndex: 10, padding: '0 24px', maxWidth: 800 }}>

        {/* Main Title - Replicating Image 1 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s var(--ease-standard) 0.05s, transform 0.8s var(--ease-standard) 0.05s',
        }}>
          <span className="label" style={{ 
            fontWeight: 600, 
            padding: '4px 12px', 
            fontSize: 13, 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 6,
            background: 'rgba(59, 130, 246, 0.08)',
            color: 'var(--accent-blue)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '999px'
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)', boxShadow: '0 0 0 2px rgba(59,130,246,0.2)' }} />
            Beta 内测阶段
          </span>
        </div>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'clamp(56px, 8vw, 96px)',
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          color: 'var(--text-primary)',
          marginBottom: 32,
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s var(--ease-standard) 0.1s, transform 0.8s var(--ease-standard) 0.1s',
        }}>
          将繁杂的信息
          <br />
          <span className="marker-highlight">结构化沉淀</span>
        </h1>

        {/* Description - Replicating Image 1 */}
        <div style={{
          fontSize: 20,
          color: 'var(--text-secondary)',
          fontWeight: 500,
          maxWidth: 480,
          marginBottom: 48,
          lineHeight: 1.8,
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.8s var(--ease-standard) 0.3s, transform 0.8s var(--ease-standard) 0.3s',
        }}>
          一款为终身学习者打造的研究引擎。<br/>
          通过清晰的工作流，化繁为简<br/>
          穿透信息噪音。
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          opacity: titleVisible ? 1 : 0,
          transform: titleVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.8s var(--ease-standard) 0.4s, transform 0.8s var(--ease-standard) 0.4s',
        }}>
          <button className="btn-primary btn-blue" onClick={onStart} style={{ padding: '16px 40px', fontSize: 16 }}>
            进入平台核心 →
          </button>
          <button className="btn-primary" onClick={onGuide} style={{ padding: '16px 40px', fontSize: 16 }}>
            系统架构白皮书
          </button>
        </div>
        
        {/* Caption at bottom */}
        <div style={{
          marginTop: 64,
          fontFamily: 'serif',
          fontStyle: 'italic',
          color: 'var(--text-dim)',
          fontSize: 16,
          opacity: titleVisible ? 1 : 0,
          transition: 'opacity 1.2s ease 0.8s',
        }}>
          "Knowledge is recognizing the connections."<br/>
          <span style={{ fontSize: 12, fontStyle: 'normal', fontFamily: 'var(--font-body)' }}>黑ICP备2025046407号-3</span>
        </div>
      </div>

      {/* Stats Floating Panel */}
      <div className="panel" style={{
        position: 'absolute',
        right: '5%',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        width: '100%',
        maxWidth: 320,
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        opacity: titleVisible ? 1 : 0,
        transition: 'opacity 0.8s ease 0.6s',
      }}>
        {STATS.map((s) => (
          <div key={s.label} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div className="counter-number" style={{ fontSize: 40, color: s.color }}>
              <Counter to={s.value} suffix={s.suffix} />
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Ticker - Light styling */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
        padding: '12px 0',
        overflow: 'hidden',
        boxShadow: '0 -4px 6px -1px rgba(0,0,0,0.02)',
      }}>
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '0 40px',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ color: 'var(--text-dim)', marginRight: 16, fontSize: 10 }}>●</span>
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
