import { useState } from 'react';
import { useInView } from '../hooks/useInView';
import { BookOpenCheck, DatabaseBackup, Send, Sparkles, Users } from 'lucide-react';

const ECOSYSTEM_FEATURES = [
  {
    id: 'log',
    title: '???????????',
    icon: DatabaseBackup,
    color: 'var(--accent-blue)',
    desc: '????????????????????????????????',
  },
  {
    id: 'collab',
    title: '????????Alpha?',
    icon: Users,
    color: 'var(--accent-violet)',
    desc: '??????????? DAG ????????????????',
  },
  {
    id: 'custom',
    title: '?????????',
    icon: Sparkles,
    color: 'var(--accent-amber)',
    desc: '???????????? Python/JavaScript ????????????',
  },
  {
    id: 'publish',
    title: '????????? Fork',
    icon: Send,
    color: 'var(--accent-emerald)',
    desc: '?????????????? Fork ????????????????',
  },
  {
    id: 'kg',
    title: '??????????',
    icon: BookOpenCheck,
    color: 'var(--accent-rose)',
    desc: '??????????????????? RAG ?????????',
  },
];

export default function PlatformEcosystem() {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  return (
    <section id="ecosystem" className="grid-bg" style={{ padding: '40px 0 80px', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        
        {/* Header */}
        <div className="reveal" style={{ marginBottom: 64, textAlign: 'center' }}>
          <span className="label label-blue" style={{ marginBottom: 20, display: 'inline-flex' }}>
            PLATFORM ECOSYSTEM
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
            ?????
            <br />
            <span className="marker-highlight" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>??????????</span>
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
            ????????????????StudySolo ??????????????
          </p>
        </div>

        {/* Feature Grid */}
        <div ref={ref} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 24,
        }}>
          {ECOSYSTEM_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            const isHovered = hoveredFeature === feature.id;

            return (
              <div
                key={feature.id}
                onMouseEnter={() => setHoveredFeature(feature.id)}
                onMouseLeave={() => setHoveredFeature(null)}
                style={{
                  background: isHovered ? 'var(--bg-surface)' : '#ffffff',
                  borderRadius: 24,
                  border: `1px solid ${isHovered ? feature.color : 'var(--border-subtle)'}`,
                  padding: 32,
                  transition: 'all var(--dur-base) var(--ease-standard)',
                  transform: isHovered ? 'translateY(-8px)' : 'none',
                  boxShadow: isHovered ? `0 24px 48px -12px ${feature.color}15` : '0 4px 6px rgba(0,0,0,0.02)',
                  opacity: inView ? 1 : 0,
                  animation: inView ? `fadeUp 0.5s ease ${i * 0.1}s both` : 'none',
                }}
              >
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: `${feature.color}10`,
                  color: feature.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 24,
                  transform: isHovered ? 'scale(1.1) rotate(-5deg)' : 'none',
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}>
                  <Icon size={28} strokeWidth={isHovered ? 2.5 : 2} />
                </div>
                
                <h3 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 12,
                  letterSpacing: '-0.01em',
                }}>
                  {feature.title}
                </h3>
                
                <p style={{
                  fontSize: 15,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}>
                  {feature.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
