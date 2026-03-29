import React from 'react';
import { useScrollReveal } from '../hooks/useScrollReveal';

/* ============================================
   Custom inline diagrams for each feature
   ============================================ */

/** 1. 明暗线双轨架构 — dual-track concept diagram */
const DualTrackDiagram = () => (
    <div className="feature-diagram-panel">
        {/* Grid pattern */}
        <div className="diagram-grid-bg" style={{
            position: 'absolute', inset: 0,
            backgroundSize: '24px 24px',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', position: 'relative' }}>
            <span className="diagram-header-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 700 }}>
                DUAL-TRACK ARCHITECTURE
            </span>
            <span className="diagram-header-badge" style={{ fontSize: '0.6rem', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                RUNTIME
            </span>
        </div>

        {/* 暗线 — Implicit Track */}
        <div className="track-implicit" style={{
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '0.75rem',
            position: 'relative',
        }}>
            <div className="track-label-tag" style={{ position: 'absolute', top: '-8px', left: '12px', fontSize: '0.55rem', fontWeight: 800, padding: '1px 8px', borderRadius: '4px', letterSpacing: '0.1em' }}>
                暗线 · IMPLICIT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem' }}>🧠</span>
                <span className="track-title" style={{ fontSize: '0.75rem', fontWeight: 700 }}>全局上下文 JSON 状态机</span>
                <span className="always-on-badge" style={{ marginLeft: 'auto', fontSize: '0.55rem', padding: '1px 6px', borderRadius: '3px' }}>ALWAYS-ON</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['主题:React进阶', '风格:学术严谨', '受众:中级开发者', '大纲:3章节'].map((tag, i) => (
                    <span key={i} className="tag-chip" style={{
                        fontSize: '0.6rem', padding: '2px 8px', borderRadius: '4px',
                    }}>{tag}</span>
                ))}
            </div>
        </div>

        {/* Injection arrows */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', position: 'relative' }}>
            <svg width="160" height="24" viewBox="0 0 160 24"><defs><linearGradient id="inj" x1="0%" y1="0%" x2="100%"><stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" /><stop offset="100%" stopColor="#6366F1" stopOpacity="0.1" /></linearGradient></defs>
                <path d="M20 12 L70 12" stroke="url(#inj)" strokeWidth="1.5" strokeDasharray="3,3" />
                <path d="M90 12 L140 12" stroke="url(#inj)" strokeWidth="1.5" strokeDasharray="3,3" />
                <path d="M80 2 L80 22" stroke="#6366F1" strokeWidth="1" strokeOpacity="0.4" />
                <circle cx="80" cy="12" r="3" fill="#6366F1" opacity="0.6" />
            </svg>
            <span className="inject-label" style={{ position: 'absolute', fontSize: '0.5rem', letterSpacing: '0.08em' }}>INJECT TO SYSTEM PROMPT</span>
        </div>

        {/* 明线 — Explicit Track */}
        <div className="track-explicit" style={{
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            position: 'relative',
        }}>
            <div className="track-label-tag" style={{ position: 'absolute', top: '-8px', left: '12px', fontSize: '0.55rem', fontWeight: 800, padding: '1px 8px', borderRadius: '4px', letterSpacing: '0.1em' }}>
                明线 · EXPLICIT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem' }}>📝</span>
                <span className="track-title" style={{ fontSize: '0.75rem', fontWeight: 700 }}>工作节点执行管线</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {[
                    { name: '前言', status: '✓', color: '#10B981' },
                    { name: '正文§1', status: '✓', color: '#10B981' },
                    { name: '正文§2', status: '●', color: '#6366F1' },
                    { name: '结论', status: '…', color: '#475569' },
                ].map((node, i) => (
                    <React.Fragment key={i}>
                        <div className={`node-box ${node.status === '●' ? 'node-active' : ''}`} style={{
                            flex: 1, padding: '0.5rem', borderRadius: '8px', textAlign: 'center',
                            opacity: node.status === '…' ? 0.4 : 1,
                        }}>
                            <div className={node.status === '●' ? 'node-name-active' : 'node-name'} style={{ fontSize: '0.7rem', fontWeight: 600, marginBottom: '2px' }}>{node.name}</div>
                            <span style={{ fontSize: '0.6rem', color: node.color }}>{node.status === '✓' ? 'DONE' : node.status === '●' ? 'RUNNING' : 'PENDING'}</span>
                        </div>
                        {i < 3 && <span style={{ color: '#94a3b8', fontSize: '0.6rem' }}>→</span>}
                    </React.Fragment>
                ))}
            </div>
        </div>
    </div>
);

/** 2. 人机协同 — Human-in-the-Loop diagram */
const HumanLoopDiagram = () => (
    <div className="feature-diagram-panel">
        <div className="diagram-grid-bg" style={{ position: 'absolute', inset: 0, backgroundSize: '24px 24px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', position: 'relative' }}>
            <span className="diagram-header-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 700 }}>HUMAN-IN-THE-LOOP</span>
            <span className="paused-badge" style={{ fontSize: '0.55rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>⏸ PAUSED</span>
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {/* Step 1: Done */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="step-done-circle" style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0 }}>✓</div>
                <div className="step-text" style={{ flex: 1, fontSize: '0.72rem' }}>大纲生成 → <span style={{ color: '#34D399' }}>完成</span></div>
                <span className="pending-text" style={{ fontSize: '0.55rem' }}>1.2s</span>
            </div>

            {/* Step 2: Paused — Human Override */}
            <div className="override-zone" style={{ borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div className="override-pause-circle" style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', flexShrink: 0, border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 10px rgba(245,158,11,0.2)' }}>✏️</div>
                    <div style={{ flex: 1 }}>
                        <div className="override-title" style={{ fontSize: '0.72rem', fontWeight: 600 }}>正文撰写 — 人工介入</div>
                        <div className="override-sub" style={{ fontSize: '0.55rem' }}>用户正在修改 AI 输出...</div>
                    </div>
                </div>

                <div className="code-preview" style={{ borderRadius: '8px', padding: '0.75rem', position: 'relative' }}>
                    <div className="code-old" style={{ fontSize: '0.6rem', textDecoration: 'line-through', marginBottom: '0.3rem', opacity: 0.5 }}>
                        React Hooks 基于组件概念设计...
                    </div>
                    <div className="code-new" style={{ fontSize: '0.65rem', borderLeft: '2px solid #10B981', paddingLeft: '0.5rem' }}>
                        React Hooks 基于 Fiber 链表的 memoizedState 实现...<span style={{ display: 'inline-block', width: 6, height: 12, background: '#6366F1', animation: 'blink 1s infinite', marginLeft: 2, verticalAlign: 'middle' }} />
                    </div>
                </div>
            </div>

            {/* Step 3: Will resume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="pending-circle" style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', flexShrink: 0 }}>3</div>
                <div className="pending-text" style={{ flex: 1, fontSize: '0.72rem' }}>结论汇总 → <span style={{ fontStyle: 'italic' }}>等待恢复</span></div>
            </div>
        </div>

        {/* Resume button */}
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <div className="resume-btn" style={{
                fontSize: '0.65rem', fontWeight: 700,
                padding: '0.4rem 1rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.4rem',
            }}>
                ▶ 确认修改 · 继续执行
            </div>
        </div>
    </div>
);

/** 3. Map-Reduce 拆解聚合 diagram */
const MapReduceDiagram = () => (
    <div className="feature-diagram-panel">
        <div className="diagram-grid-bg" style={{ position: 'absolute', inset: 0, backgroundSize: '24px 24px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', position: 'relative' }}>
            <span className="diagram-header-label" style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const, fontWeight: 700 }}>MAP → REDUCE → EXPORT</span>
        </div>

        {/* MAP Phase */}
        <div style={{ marginBottom: '0.75rem' }}>
            <div className="phase-label-map" style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '3px', background: 'rgba(96,165,250,0.2)', border: '1px solid rgba(96,165,250,0.4)', textAlign: 'center', lineHeight: '10px', fontSize: '0.4rem' }}>M</span>
                MAP PHASE · 并行分发
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
                {['§1 引言', '§2 原理', '§3 实践', '§4 进阶'].map((s, i) => (
                    <div key={i} className="map-node" style={{
                        flex: 1, padding: '0.5rem 0.4rem', borderRadius: '8px', textAlign: 'center',
                    }}>
                        <div className="map-node-name" style={{ fontSize: '0.6rem', fontWeight: 600, marginBottom: '3px' }}>{s}</div>
                        <div style={{
                            height: 3, borderRadius: 2, background: 'rgba(96,165,250,0.1)', overflow: 'hidden',
                        }}>
                            <div style={{ height: '100%', width: `${[100, 100, 65, 30][i]}%`, background: i < 2 ? '#10B981' : '#60A5FA', transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ fontSize: '0.45rem', color: i < 2 ? '#34D399' : '#60A5FA', marginTop: '3px' }}>{i < 2 ? 'DONE' : i === 2 ? '65%' : '30%'}</div>
                    </div>
                ))}
            </div>
        </div>

        {/* Arrow down */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.15rem 0' }}>
            <svg width="20" height="16" viewBox="0 0 20 16"><path d="M10 0 L10 12 M5 8 L10 14 L15 8" stroke="#94a3b8" strokeWidth="1.5" fill="none" /></svg>
        </div>

        {/* REDUCE Phase */}
        <div style={{ marginBottom: '0.75rem' }}>
            <div className="phase-label-reduce" style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '3px', background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.4)', textAlign: 'center', lineHeight: '10px', fontSize: '0.4rem' }}>R</span>
                REDUCE PHASE · 聚合润色
            </div>
            <div className="reduce-zone">
                <div className="reduce-chip" style={{ display: 'flex', gap: '0.75rem', fontSize: '0.55rem' }}>
                    <span>🔗 合并上下文</span>
                    <span>✂️ 消除冗余</span>
                    <span>🎨 统一风格</span>
                </div>
            </div>
        </div>

        {/* Arrow down */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0.15rem 0' }}>
            <svg width="20" height="16" viewBox="0 0 20 16"><path d="M10 0 L10 12 M5 8 L10 14 L15 8" stroke="#94a3b8" strokeWidth="1.5" fill="none" /></svg>
        </div>

        {/* EXPORT Phase */}
        <div>
            <div className="phase-label-export" style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '3px', background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', textAlign: 'center', lineHeight: '10px', fontSize: '0.4rem' }}>E</span>
                EXPORT · 格式化输出
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {[
                    { label: 'PDF', icon: '📕', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
                    { label: 'DOCX', icon: '📄', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
                    { label: 'MD', icon: '📝', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
                ].map((f, i) => (
                    <div key={i} style={{
                        flex: 1, padding: '0.4rem', borderRadius: '6px', textAlign: 'center',
                        background: f.bg, border: `1px solid ${f.border}`,
                    }}>
                        <div style={{ fontSize: '1rem', marginBottom: '2px' }}>{f.icon}</div>
                        <div style={{ fontSize: '0.55rem', color: '#94A3B8', fontWeight: 600 }}>{f.label}</div>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

/** 4. 透明化运行看板 — uses existing dashboard_workspace screenshot */
const ObservabilityImage = () => (
    <div className="feature-image-panel" style={{
        boxShadow: '0 30px 60px -15px rgba(0,0,0,0.1), 0 0 50px -10px rgba(245,158,11,0.2)',
        borderColor: 'rgba(245,158,11,0.3)',
    }}>
        <img src={`${import.meta.env.BASE_URL}images/dashboard_overview.png`} alt="StudySolo 工作流执行界面，展示节点透明运行看板" style={{ filter: 'contrast(1.05) saturate(1.1)' }} />
    </div>
);

/* ============================================
   Feature data
   ============================================ */
const features = [
    {
        title: '节点即智能体与执行管线',
        subtitle: 'Node as Agent & DAG Executor',
        desc: '颠覆单轮聊天的局限性。平台采用有向无环图结构，将复杂的学习任务拆解为多节点协作系统。每个节点均是一个具备独立提示词、可单独调度大模型的智能体，并通过 ExecutionContext 黑板模型保障上下文的一致传递。',
        details: ['拓扑排序驱动多智能体流转', '上下文共享数据黑板 (ExecutionContext)', '细粒度任务隔离，产出稳定可溯'],
        color: 'var(--brand-blue)',
        iconClass: 'icon-box-blue',
        icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /></svg>,
        visual: <DualTrackDiagram />,
    },
    {
        title: '自然语言画布编排',
        subtitle: 'Natural Language Workflow Generation',
        desc: '免去枯燥的拖拽连线，对小白极度友好。你只需在侧边栏用自然语言说出学习意图，系统就能自动感知并识别，即刻生成所需的多个节点与连线拓扑图；想要调整流程只需再次吩咐，AI 立刻自动修改画布结构。',
        details: ['基于画布序列化的全息感知', '意图分类器自动识别创建/修改模式', '基于内存快照的安全回滚撤销机制'],
        color: 'var(--brand-purple)',
        iconClass: 'icon-box-purple',
        icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
        visual: <HumanLoopDiagram />,
    },
    {
        title: '多端路由与降级容灾',
        subtitle: 'Platform Routing & Graceful Degradation',
        desc: '不必受困于单一平台。底层路由模块无缝对接 DeepSeek、百炼、智谱、Kimi 等全球 8 个 AI 平台 17+ 款优质模型。配合强大的后备容灾策略，哪怕单个 API 突然宕机或超额限流，引擎也能自动快速切流，提供无感稳定服务。',
        details: ['原生 + 七牛代理 多重混合请求模式', '三种智能模型选取策略', '全局统一调配并发容灾降级'],
        color: 'var(--brand-emerald)',
        iconClass: 'icon-box-emerald',
        icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>,
        visual: <MapReduceDiagram />,
    },
    {
        title: '透明全可见执行面板',
        subtitle: 'Observability & Streaming Track',
        desc: '告别焦虑的系统黑盒。右侧面板结合 Server-Sent Events 流式协议，同步推流各个节点的执行状态、输入输出记录：从发起调用、开始推理到传输分词字串。每一个细节的脉络都如心电图般实时刻画在你的眼前。',
        details: ['7 种进度与状态流式推送事件', '链路数据与报错信息溯源追踪', '原生打字机预览效果'],
        color: 'var(--brand-amber)',
        iconClass: 'icon-box-amber',
        icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
        visual: <ObservabilityImage />,
    },
];

/* ============================================
   Features component
   ============================================ */
const Features: React.FC = () => {
    return (
        <section className="section" id="features">
            <div className="container">
                <SectionHeader />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8rem' }}>
                    {features.map((f, i) => (
                        <FeatureRow key={i} feature={f} index={i} />
                    ))}
                </div>
            </div>
        </section>
    );
};

/* Animated section header */
const SectionHeader: React.FC = () => {
    const { ref, isVisible } = useScrollReveal();
    return (
        <div ref={ref} style={{
            textAlign: 'center', marginBottom: '5rem',
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            <span className="section-label">✨ 核心创新</span>
            <h2 className="section-title">四大核心创举</h2>
            <p className="section-subtitle">
                这是 StudySolo 区别于市面上所有 AI 工具的核心竞争力。不仅提高上限，更保住工作流的下限。
            </p>
        </div>
    );
};

/* Each feature row with scroll-triggered animations */
const FeatureRow: React.FC<{ feature: typeof features[0]; index: number }> = ({ feature: f, index: i }) => {
    const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });
    const isEven = i % 2 === 0;

    const textStyle: React.CSSProperties = {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : `translateX(${isEven ? '-50px' : '50px'})`,
        transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 100ms, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 100ms',
    };
    const visualStyle: React.CSSProperties = {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0) scale(1)' : `translateX(${isEven ? '50px' : '-50px'}) scale(0.95)`,
        transition: 'opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) 300ms, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 300ms',
    };

    return (
        <div
            ref={ref}
            style={{
                display: 'flex',
                flexDirection: isEven ? 'row' : 'row-reverse',
                alignItems: 'center',
                gap: '4rem',
                flexWrap: 'wrap',
            }}
        >
            {/* Text */}
            <div style={{ flex: '1 1 400px', maxWidth: '600px', ...textStyle }}>
                <div className={`icon-box ${f.iconClass}`} style={{ marginBottom: '1.5rem', transform: 'scale(1.2)', transformOrigin: 'left center' }}>
                    {f.icon}
                </div>
                <h3 style={{ fontSize: '2.2rem', marginBottom: '0.5rem', fontWeight: 800 }}>{f.title}</h3>
                <span style={{ fontSize: '1rem', color: f.color, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', display: 'block', marginBottom: '1.5rem' }}>
                    {f.subtitle}
                </span>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.85, fontSize: '1.1rem', marginBottom: '2rem' }}>{f.desc}</p>

                <div style={{
                    display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.5rem',
                    borderRadius: 'var(--radius-lg)',
                    background: `linear-gradient(135deg, ${f.color}12, ${f.color}05)`,
                    border: `1px solid ${f.color}20`,
                    boxShadow: `0 4px 20px ${f.color}10`,
                }}>
                    {f.details.map((detail, j) => (
                        <div key={j} style={{
                            display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500,
                            opacity: isVisible ? 1 : 0,
                            transform: isVisible ? 'translateX(0)' : 'translateX(-20px)',
                            transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${500 + j * 120}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${500 + j * 120}ms`,
                        }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${f.color}25`, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', fontWeight: 'bold' }}>✓</div>
                            {detail}
                        </div>
                    ))}
                </div>
            </div>

            {/* Visual — custom diagram or image */}
            <div style={{ flex: '1 1 500px', position: 'relative', ...visualStyle }}>
                {f.visual}
                <div style={{
                    position: 'absolute', top: '40%', left: '50%', width: '80%', height: '80%',
                    background: f.color, opacity: 0.12, transform: 'translate(-50%, -50%)',
                    filter: 'blur(80px)', zIndex: -1, borderRadius: '50%',
                }} />
            </div>
        </div>
    );
};

export default Features;
