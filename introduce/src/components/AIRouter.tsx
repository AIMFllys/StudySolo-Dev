import { useEffect, useState } from 'react';
import { useInView } from '../hooks/useInView';
import {
  Banknote,
  Bean,
  BrainCircuit,
  Cloud,
  Flame,
  Gem,
  Lock,
  Moon,
  RefreshCcw,
  Target,
  TimerOff,
  TrendingDown,
  Waves,
  Zap,
} from 'lucide-react';

const AI_PLATFORMS = [
  { name: 'DeepSeek', models: 'V3 / R1', icon: BrainCircuit, mode: '????', color: '#1a6bd0', usage: '???? / ????' },
  { name: '????????', models: 'Turbo / Plus / Max', icon: Waves, mode: '?? + ??', color: '#6c47ff', usage: '???? / ?????' },
  { name: '?? GLM', models: 'GLM-4.5 / Flash', icon: Zap, mode: '????', color: '#1976d2', usage: 'OCR / ???? / ???' },
  { name: 'Kimi', models: '8K / 128K / K2.5', icon: Moon, mode: '?? + ??', color: '#7c3aed', usage: '???? / ????' },
  { name: '??????', models: 'Pro-32K / 256K', icon: Bean, mode: '?? + ??', color: '#059669', usage: '???? / ????' },
  { name: '??????', models: '?????', icon: Cloud, mode: '????', color: '#d97706', usage: '???? / ????' },
  { name: '????', models: 'Qwen2.5-72B', icon: Gem, mode: '????', color: '#0891b2', usage: '??????' },
  { name: '????', models: 'Doubao ??', icon: Flame, mode: '????', color: '#dc2626', usage: '????????' },
];

const ROUTING_STRATEGIES = [
  {
    id: 'native_first',
    name: 'native_first',
    title: '????',
    desc: '???????? API????????????',
    icon: Target,
    color: 'var(--accent-blue)',
  },
  {
    id: 'proxy_first',
    name: 'proxy_first',
    title: '????',
    desc: '?????????????????????',
    icon: Banknote,
    color: 'var(--accent-green)',
  },
  {
    id: 'capability_fixed',
    name: 'capability_fixed',
    title: '????',
    desc: '??????????? OCR ?? GLM????? Kimi?',
    icon: Lock,
    color: 'var(--accent-purple)',
  },
];

const FAILOVER_ITEMS = [
  { icon: RefreshCcw, title: '??????', desc: '????????????? SKU??????', value: '2-3 ?? / ??', color: 'var(--accent-blue)' },
  { icon: TimerOff, title: '????', desc: '????????????????????', value: '< 8s ????', color: 'var(--accent-rose)' },
  { icon: TrendingDown, title: '????', desc: '?????????????? Token ???????', value: '?? 10x ??', color: 'var(--accent-green)' },
];

export default function AIRouter() {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const [activeStrategy, setActiveStrategy] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timer = window.setInterval(() => {
      setActiveStrategy((prev) => (prev + 1) % ROUTING_STRATEGIES.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [inView]);

  return (
    <section id="ai-router" className="grid-bg" style={{ padding: '40px 0 80px', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div className="reveal" style={{ marginBottom: 64, textAlign: 'center' }}>
          <span className="label label-blue" style={{ marginBottom: 20, display: 'inline-flex' }}>
            AI MODEL ROUTER � 8 PLATFORMS
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 56px)', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 24 }}>
            8 ? AI ????
            <br />
            <span className="marker-highlight" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>???? � ????</span>
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 680, margin: '0 auto', lineHeight: 1.6 }}>
            ???? AI Router ???? 8 ?????????????????????????????????????????????????
          </p>
        </div>

        <div ref={ref} style={{ background: '#ffffff', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 40, marginBottom: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.05)', opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s var(--ease-standard), transform 0.7s var(--ease-standard)' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'inline-block', background: 'var(--bg-canvas)', borderRadius: 16, border: '2px solid var(--accent-blue)', padding: '12px 32px', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 10 }}>
              Layer 2 � DAG Executor?18 ????
            </div>
            <div style={{ fontSize: 24, color: 'var(--text-dim)', marginBottom: 10 }}>?</div>
            <div style={{ display: 'inline-block', background: '#fff7ed', borderRadius: 16, border: '2px solid var(--accent-amber)', padding: '12px 32px', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent-amber)' }}>
              Layer 3 � AI Router???????
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
            {ROUTING_STRATEGIES.map((strategy, index) => {
              const StrategyIcon = strategy.icon;
              const active = index === activeStrategy && inView;
              return (
                <div
                  key={strategy.id}
                  style={{
                    background: active ? `${strategy.color}15` : 'var(--bg-canvas)',
                    borderRadius: 16,
                    border: `1px solid ${active ? strategy.color : `${strategy.color}30`}`,
                    padding: 20,
                    textAlign: 'center',
                    transform: active ? 'translateY(-3px)' : 'translateY(0)',
                    boxShadow: active ? `0 10px 18px ${strategy.color}25` : 'none',
                    transition: 'all var(--dur-base) var(--ease-standard)',
                  }}
                >
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
                    <StrategyIcon size={32} color={strategy.color} strokeWidth={1.5} className={active ? 'flow-pulse' : ''} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: strategy.color, letterSpacing: '0.05em', marginBottom: 8, textTransform: 'uppercase' }}>
                    {strategy.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text-primary)' }}>
                    {strategy.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {strategy.desc}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 24, textAlign: 'center', color: 'var(--text-dim)', marginBottom: 24 }}>?</div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {AI_PLATFORMS.map((platform, i) => {
              const PlatformIcon = platform.icon;
              const highlighted = inView && i % ROUTING_STRATEGIES.length === activeStrategy;
              return (
                <div
                  key={platform.name}
                  style={{
                    background: `${platform.color}08`,
                    borderRadius: 16,
                    border: `1px solid ${highlighted ? platform.color : `${platform.color}25`}`,
                    padding: '16px 20px',
                    opacity: inView ? 1 : 0,
                    transform: inView ? 'translateY(0)' : 'translateY(12px)',
                    boxShadow: highlighted ? `0 8px 20px ${platform.color}20` : 'none',
                    transition: `opacity 0.4s ease ${i * 0.05}s, transform 0.4s ease ${i * 0.05}s, box-shadow var(--dur-base) var(--ease-standard), border-color var(--dur-base) var(--ease-standard)`,
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <PlatformIcon size={24} color={platform.color} strokeWidth={2} />
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {platform.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: platform.color, marginBottom: 8, letterSpacing: '0.03em' }}>
                    {platform.models}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {platform.usage}
                  </div>
                  <div style={{ marginTop: 8, display: 'inline-block', padding: '3px 8px', borderRadius: 999, background: `${platform.color}15`, fontFamily: 'var(--font-mono)', fontSize: 10, color: platform.color, fontWeight: 600 }}>
                    {platform.mode}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {FAILOVER_ITEMS.map((item) => {
            const InfoIcon = item.icon;
            return (
              <div key={item.title} style={{ background: '#ffffff', borderRadius: 20, border: '1px solid var(--border-subtle)', padding: 28, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
                <div style={{ marginBottom: 16 }}>
                  <InfoIcon size={32} color={item.color} strokeWidth={1.5} />
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: item.color, marginBottom: 8, letterSpacing: '0.05em' }}>{item.value}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {item.desc}
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @media (max-width: 1100px) {
            #ai-router > div > div:nth-child(2) > div:last-child {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 768px) {
            #ai-router > div > div:nth-child(2) > div:nth-child(3),
            #ai-router > div > div:nth-child(3) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
