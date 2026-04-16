import { useState } from 'react';
import { useInView } from '../hooks/useInView';
import {
  AppWindow,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Database,
  Download,
  FileText,
  Globe2,
  GraduationCap,
  HelpCircle,
  Loader2,
  Map,
  Microscope,
  MousePointer2,
  Network,
  PlayCircle,
  Scissors,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';

const SCENARIOS = [
  {
    id: 'machine-learning',
    title: '???????',
    subtitle: '??????',
    icon: BrainCircuit,
    input: '???????????????????????',
    color: 'var(--accent-blue)',
    flow: [
      { node: 'Trigger Input', icon: Zap, output: '?????????????', time: '0.1s' },
      { node: 'AI Planner', icon: Map, output: '????????? -> ???? -> ????', time: '1.2s' },
      { node: 'Outline Gen', icon: FileText, output: '?? 12 ??????', time: '2.0s' },
      { node: 'Web Search', icon: Search, output: '?????????????', time: '1.8s' },
      { node: 'Flashcard', icon: AppWindow, output: '?? 45 ????????', time: '2.3s' },
      { node: 'Export File', icon: Download, output: '????????Markdown?', time: '0.3s' },
    ],
    result: '6 ????????????????????????????',
  },
  {
    id: 'paper-reading',
    title: '???????',
    subtitle: '??????',
    icon: BookOpen,
    input: '????????????????????',
    color: 'var(--accent-purple)',
    flow: [
      { node: 'Trigger Input', icon: Zap, output: '????????', time: '0.1s' },
      { node: 'Knowledge Base', icon: BookOpen, output: '???????????', time: '3.0s' },
      { node: 'Content Extract', icon: Scissors, output: '?????????', time: '2.6s' },
      { node: 'AI Analyzer', icon: Microscope, output: '???????????', time: '3.8s' },
      { node: 'Summary', icon: SlidersHorizontal, output: '??????????', time: '1.9s' },
      { node: 'Quiz Gen', icon: HelpCircle, output: '?? 20 ???????', time: '2.1s' },
    ],
    result: '?????? 15 ??????????????????',
  },
  {
    id: 'exam-prep',
    title: '??????',
    subtitle: '??????',
    icon: GraduationCap,
    input: '???????????????????',
    color: 'var(--accent-green)',
    flow: [
      { node: 'Trigger Input', icon: Zap, output: '?????????', time: '0.1s' },
      { node: 'Knowledge Base', icon: BookOpen, output: '??????????', time: '1.5s' },
      { node: 'AI Analyzer', icon: Microscope, output: '??????????', time: '3.1s' },
      { node: 'Mind Map', icon: Network, output: '??????????', time: '2.0s' },
      { node: 'Flashcard', icon: AppWindow, output: '?? 60 ?????', time: '3.2s' },
      { node: 'Quiz Gen', icon: HelpCircle, output: '????????', time: '2.6s' },
    ],
    result: '10 ?????????????????????????',
  },
  {
    id: 'community-share',
    title: '??????',
    subtitle: '???????',
    icon: Globe2,
    input: '????????????????? Fork?',
    color: 'var(--accent-rose)',
    flow: [
      { node: 'Trigger Input', icon: Zap, output: '????????', time: '0.1s' },
      { node: 'Write DB', icon: Database, output: '??????????', time: '0.5s' },
      { node: 'Chat Response', icon: Sparkles, output: '???????????', time: '1.2s' },
      { node: 'Logic Switch', icon: Shuffle, output: '?? Fork ???????', time: '0.9s' },
      { node: 'Merge Polish', icon: Sparkles, output: '???????????', time: '2.0s' },
      { node: 'Export File', icon: Download, output: '??????????', time: '0.2s' },
    ],
    result: '?????????????? -> Fork -> ?? -> ?????????',
  },
];

export default function Scenarios() {
  const [active, setActive] = useState(0);
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  const scenario = SCENARIOS[active];

  const handleRun = () => {
    setCompletedSteps([]);
    setRunningStep(0);
    scenario.flow.forEach((_, i) => {
      window.setTimeout(() => {
        setRunningStep(i + 1 < scenario.flow.length ? i + 1 : null);
        setCompletedSteps((prev) => [...prev, i]);
      }, (i + 1) * 850);
    });
  };

  return (
    <section id="scenarios" className="grid-bg" style={{ padding: '40px 0 80px', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px' }}>
        <div className="reveal" style={{ marginBottom: 64, textAlign: 'center' }}>
          <span className="label label-green" style={{ marginBottom: 20, display: 'inline-flex' }}>
            REAL USE CASES ? ????
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(36px, 5vw, 56px)', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 24 }}>
            ??????
            <br />
            <span className="marker-highlight" style={{ fontSize: 'clamp(32px, 4.5vw, 48px)' }}>????????</span>
          </h2>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            ???????????????????????
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' }}>
          {SCENARIOS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActive(i);
                  setRunningStep(null);
                  setCompletedSteps([]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 24px',
                  borderRadius: 16,
                  border: `1px solid ${active === i ? s.color : 'var(--border-subtle)'}`,
                  background: active === i ? `${s.color}10` : 'var(--bg-surface)',
                  color: active === i ? s.color : 'var(--text-secondary)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--dur-fast) var(--ease-standard)',
                  boxShadow: active === i ? `0 8px 16px -4px ${s.color}20` : '0 2px 4px rgba(0,0,0,0.02)',
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'translateY(0)' : 'translateY(12px)',
                }}
              >
                <Icon size={22} color={active === i ? s.color : 'var(--text-dim)'} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{s.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div ref={ref} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 32, opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.7s ease, transform 0.7s ease' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid var(--border-subtle)', padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MousePointer2 size={12} />
                {'USER INPUT -> DAG'}
              </div>
              <div style={{ background: 'var(--bg-canvas)', borderRadius: 12, padding: '16px 20px', fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6, border: `1px solid ${scenario.color}30`, display: 'flex', gap: 12 }}>
                <span style={{ color: scenario.color, fontSize: 22 }}>#</span>
                {scenario.input}
              </div>
              <button
                onClick={handleRun}
                style={{ marginTop: 16, width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: scenario.color, color: '#ffffff', fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <PlayCircle size={20} />
                {'???????'}
              </button>
            </div>

            <div style={{ background: '#ffffff', borderRadius: 20, border: '1px solid var(--border-subtle)', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-canvas)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>EXECUTION LOG</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: completedSteps.length === scenario.flow.length ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                  {completedSteps.length}/{scenario.flow.length} NODES
                </span>
              </div>
              <div style={{ padding: 4 }}>
                {scenario.flow.map((step, i) => {
                  const isDone = completedSteps.includes(i);
                  const isRunning = runningStep === i;
                  const NodeIcon = step.icon;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 12, margin: 4, background: isRunning ? `${scenario.color}08` : isDone ? 'var(--bg-canvas)' : 'transparent', border: `1px solid ${isRunning ? `${scenario.color}40` : isDone ? 'var(--border-subtle)' : 'transparent'}` }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isDone ? `${scenario.color}20` : isRunning ? `${scenario.color}30` : 'var(--bg-canvas)', border: `1px solid ${isDone ? `${scenario.color}50` : isRunning ? scenario.color : 'var(--border-subtle)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isDone || isRunning ? scenario.color : 'var(--text-dim)' }}>
                        {isDone ? <CheckCircle2 size={16} /> : isRunning ? <span style={{ animation: 'spin 1s linear infinite', display: 'flex' }}><Loader2 size={16} /></span> : <NodeIcon size={16} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: isDone || isRunning ? scenario.color : 'var(--text-dim)' }}>{step.node}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>{step.time}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {(isDone || isRunning) ? step.output : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 20, border: `2px solid ${scenario.color}30`, padding: 40, boxShadow: `0 20px 40px -8px ${scenario.color}15` }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: scenario.color, marginBottom: 12 }}>{scenario.subtitle}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, color: 'var(--text-primary)', marginBottom: 20 }}>{scenario.title}</h3>
              <div style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 28, padding: 20, background: `${scenario.color}08`, borderRadius: 12, borderLeft: `4px solid ${scenario.color}` }}>
                {scenario.result}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {scenario.flow.map((step, i) => (
                  <div key={step.node} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, background: completedSteps.includes(i) ? `${scenario.color}15` : 'var(--bg-canvas)', border: `1px solid ${completedSteps.includes(i) ? `${scenario.color}40` : 'var(--border-subtle)'}` }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: completedSteps.includes(i) ? scenario.color : 'var(--text-dim)' }}>{step.node}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-canvas)', borderRadius: 16, border: '1px solid var(--border-subtle)', padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'center' }}>
              <ClipboardList size={24} color="var(--text-secondary)" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>???????</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>?????????????? Fork ??????</div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (max-width: 900px) {
            #scenarios > div > div:last-child {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
