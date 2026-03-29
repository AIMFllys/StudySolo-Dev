import { useEffect, useRef } from 'react';
import { useInView } from '../hooks/useInView';
import { useScramble } from '../hooks/useScramble';

interface HeroProps {
  onStart?: () => void;
  onGuide?: () => void;
}

const TICKER_ITEMS = [
  { label: 'DAG Executor', value: 'ONLINE' },
  { label: '18 种工作流节点', value: 'ACTIVE' },
  { label: '8 AI 平台 × 17+ 模型', value: 'ROUTING' },
  { label: 'SSE 流式推送', value: 'STREAMING' },
  { label: 'Supabase + RLS', value: 'SECURED' },
  { label: '前端 React 19 + Next.js', value: 'RUNNING' },
  { label: '后端 Python FastAPI', value: 'PORT 2038' },
  { label: '华科 AI 智能体大赛', value: 'HUST 2025' },
  { label: 'StudyFlow.1037solo.com', value: 'LIVE' },
];

const STATS = [
  { value: '18', label: '种专业学习节点', suffix: '' },
  { value: '8', label: 'AI 平台接入', suffix: '' },
  { value: '17', label: '+ 模型 SKU', suffix: '' },
  { value: '7', label: '种 SSE 事件类型', suffix: '' },
];

export default function Hero({ onStart, onGuide }: HeroProps) {
  const [ref] = useInView<HTMLDivElement>(0.1);
  const titleText = '可视化编排\nAI学习智能体';
  const scrambled = useScramble('StudySolo', true, 35);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Grid dot animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const spacing = 60;
      const cols = Math.ceil(canvas.width / spacing);
      const rows = Math.ceil(canvas.height / spacing);

      for (let x = 0; x <= cols; x++) {
        for (let y = 0; y <= rows; y++) {
          const px = x * spacing;
          const py = y * spacing;
          const wave = Math.sin(x * 0.5 + t) * Math.cos(y * 0.5 + t * 0.7);
          const alpha = Math.max(0, Math.min(0.35, 0.05 + wave * 0.12));
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 232, 122, ${alpha})`;
          ctx.fill();
        }
      }
      t += 0.008;
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <section className="hero" ref={ref}>
      {/* Animated dot grid */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.6,
          pointerEvents: 'none',
        }}
      />

      {/* Grid line bg */}
      <div className="hero-grid-bg" />

      {/* Scan line */}
      <div className="hero-scan-line" />

      {/* Main content */}
      <div className="hero-content">
        {/* Eyebrow */}
        <div className="hero-eyebrow animate-in">
          <div className="signal-tag">华科 AI 智能体大赛参赛作品</div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
          }}>
            <span style={{ color: 'var(--green)' }}>{scrambled}</span>
            <span className="terminal-cursor">_</span>
          </div>
        </div>

        {/* Main title */}
        <h1 className="hero-title animate-in animate-in-delay-1">
          {titleText.split('\n').map((line, i) => (
            <span key={i} style={{ display: 'block' }}>
              {i === 1 ? (
                <>
                  <span className="hero-title-accent">{line.slice(0, 2)}</span>
                  {line.slice(2)}
                </>
              ) : line}
            </span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle animate-in animate-in-delay-2">
          用自然语言描述学习目标，系统自动生成多节点 DAG 工作流。18 种专业学习节点在执行引擎调度下按依赖顺序运行，全程 SSE 实时可观测。不是对话助手，是完整的学习智能体平台。
        </p>

        {/* CTAs */}
        <div className="hero-cta animate-in animate-in-delay-3">
          <a
            href="https://StudyFlow.1037solo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            <span>立即体验平台</span>
            <span>↗</span>
          </a>
          <a
            href="https://github.com/AIMFllys/StudySolo"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            <span>⊹</span>
            <span>GitHub 开源</span>
          </a>
          <button className="btn btn-ghost" onClick={onGuide}>
            文档中心 →
          </button>
        </div>

        {/* Meta info */}
        <div className="hero-meta animate-in animate-in-delay-4">
          {[
            ['b23.tv/uPd6KUr', 'Demo 视频'],
            ['StudyFlow.1037solo.com', '生产环境'],
            ['AIMFllys/StudySolo', 'GitHub'],
          ].map(([url, label]) => (
            <div key={label} className="hero-meta-item">
              <span>◈</span>
              <span>{label}:</span>
              <span style={{ color: 'var(--green)', fontSize: '0.7rem' }}>{url}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats ticker */}
      <div className="ticker-wrapper animate-in animate-in-delay-5">
        <div className="ticker-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="ticker-item">
              <span>{item.label}</span>
              <span className="accent">·</span>
              <span className="accent">{item.value}</span>
              <span style={{ color: 'var(--text-faint)', marginLeft: '1rem' }}>／</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ marginTop: '3rem', maxWidth: 1180, margin: '3rem auto 0', padding: '0 1.5rem', position: 'relative', zIndex: 2 }}>
        <div className="stats-bar animate-in animate-in-delay-5">
          {STATS.map(stat => (
            <div key={stat.label} className="stat-cell">
              <div className="stat-number">
                {stat.value}<span className="accent">{stat.suffix}</span>
              </div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
