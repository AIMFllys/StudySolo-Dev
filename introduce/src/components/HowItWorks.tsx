import { useState, useEffect, useRef } from 'react';
import { useInView } from '../hooks/useInView';

const STEPS = [
  {
    id: 'intent',
    step: 'LAYER 0 — INTENT',
    title: '自然语言描述学习目标',
    desc: '无需了解 DAG、节点、连线等概念。在侧边栏 AI 面板用自然语言说出学习需求，系统分类为 BUILD / MODIFY / CHAT / ACTION 四种意图，直接驱动后续流程。',
    detail: '> 用户输入: "帮我系统学习机器学习基础"\n> 意图分类: BUILD\n> 触发规划层...',
    icon: '▸',
    color: 'var(--green)',
  },
  {
    id: 'plan',
    step: 'LAYER 1 — PLAN',
    title: 'AI 自动生成工作流节点图',
    desc: 'AI Planner 将学习目标拆解为带有节点类型、连线关系、初始配置的完整节点图。用户也可在画布上拖拽增删节点，支持 Undo/Redo，AI 与手动编辑随时切换。',
    detail: '> Planner 生成 6 个节点:\n> trigger → analyzer → outline_gen\n> → summary → flashcard → export_file',
    icon: '⊞',
    color: 'var(--ice)',
  },
  {
    id: 'execute',
    step: 'LAYER 2-3 — EXECUTE',
    title: 'DAG 引擎按依赖顺序执行',
    desc: '自研 DAG Executor 拓扑排序确定执行顺序，通过 ExecutionContext 黑板模型在节点间传递中间结果。每个节点是独立 AI 智能体，拥有独立 Prompt、模型配置和输出契约。',
    detail: '> NODE [1/6] trigger_input → DONE\n> NODE [2/6] ai_analyzer → RUNNING\n> Streaming tokens via SSE...',
    icon: '◈',
    color: 'var(--orange)',
  },
  {
    id: 'observe',
    step: 'LAYER 4 — OBSERVE',
    title: 'SSE 流式推送，全程可观测',
    desc: '执行面板实时渲染 7 种 SSE 事件：node_input、node_status、node_token、node_done、loop_iteration、save_error、workflow_done。不是黑盒，每一步 AI 在做什么一目了然。',
    detail: '> event: node_token\n> data: {"node":"ai_analyzer","token":"机"}\n> event: node_done\n> data: {"duration":2341,"tokens":847}',
    icon: '◉',
    color: 'var(--green)',
  },
  {
    id: 'share',
    step: 'COMMUNITY',
    title: '保存、分享、分叉工作流',
    desc: '优秀工作流可发布至社区，支持其他用户浏览、收藏、Fork 形成自己的版本。平台用户既是使用者，也是能力构建者。社区积累的工作流模板持续降低学习设计门槛。',
    detail: '> workflow.publish()\n> status: 已发布至社区\n> forks: 12  likes: 47',
    icon: '⊹',
    color: 'var(--ice)',
  },
];

export default function HowItWorks() {
  const [ref, inView] = useInView<HTMLDivElement>(0.1);
  const [activeStep, setActiveStep] = useState(0);
  const [lineHeight, setLineHeight] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!inView) return;
    // Auto-advance steps
    intervalRef.current = setInterval(() => {
      setActiveStep(prev => (prev + 1) % STEPS.length);
    }, 2800);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [inView]);

  // Update spine fill
  useEffect(() => {
    setLineHeight(((activeStep + 1) / STEPS.length) * 100);
  }, [activeStep]);

  const handleStepClick = (i: number) => {
    setActiveStep(i);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <section className="section" id="how-it-works" ref={ref}>
      <div className="container">
        {/* Header */}
        <div className={`section-header reveal${inView ? ' visible' : ''}`}>
          <div className="signal-tag">How It Works</div>
          <h2 className="section-title">五层架构，从意图到结果</h2>
          <p className="section-desc">
            StudySolo 设计了清晰的五层架构：意图理解 → AI 规划 → DAG 编排 → 智能体执行 → 实时可观测。每一层有明确的职责边界。
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'start' }}>
          {/* Left: Timeline */}
          <div className={`timeline reveal${inView ? ' visible' : ''} reveal-delay-2`}>
            {/* Spine */}
            <div className="timeline-spine">
              <div
                className="timeline-spine-fill"
                style={{ height: `${lineHeight}%` }}
              />
            </div>

            {STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`timeline-item${i === activeStep ? ' active' : ''}`}
                onClick={() => handleStepClick(i)}
                style={{ cursor: 'pointer' }}
              >
                <div className="timeline-node">
                  <div className="timeline-dot" />
                </div>
                <div className="timeline-body">
                  <div className="timeline-step">{step.step}</div>
                  <div className="timeline-title">{step.title}</div>
                  <p className="timeline-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Detail panel */}
          <div
            className={`reveal reveal-delay-3${inView ? ' visible' : ''}`}
            style={{ position: 'sticky', top: '7rem' }}
          >
            <div
              style={{
                background: 'var(--black)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                transition: 'border-color 300ms',
                borderColor: STEPS[activeStep].color === 'var(--green)' ? 'var(--border-green)' : 'var(--border-ice)',
              }}
            >
              {/* Header */}
              <div style={{
                padding: '0.6rem 1rem',
                borderBottom: '1px solid var(--border)',
                background: 'var(--black-2)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  studysolo_engine.log
                </span>
              </div>

              {/* Content */}
              <div style={{ padding: '1.5rem' }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: STEPS[activeStep].color,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: '0.75rem',
                }}>
                  {STEPS[activeStep].step}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.025em',
                  marginBottom: '1rem',
                }}>
                  {STEPS[activeStep].icon} {STEPS[activeStep].title}
                </div>

                {/* Terminal detail */}
                <div style={{
                  background: '#010408',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.25rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: 'var(--green)',
                  lineHeight: 1.8,
                  whiteSpace: 'pre',
                  marginBottom: '1rem',
                  minHeight: '100px',
                }}>
                  {STEPS[activeStep].detail}
                  <span className="terminal-cursor">_</span>
                </div>
              </div>

              {/* Step indicator dots */}
              <div style={{
                padding: '0.75rem 1.5rem',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
              }}>
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => handleStepClick(i)}
                    style={{
                      width: i === activeStep ? 20 : 6,
                      height: 4,
                      borderRadius: 2,
                      background: i === activeStep ? STEPS[activeStep].color : 'var(--border)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 300ms var(--ease-out)',
                      padding: 0,
                    }}
                  />
                ))}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                  {activeStep + 1}/{STEPS.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .timeline-panel-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
